import Stripe from "stripe";
import { DataSource } from "typeorm";
import {
  WeeklyPlan,
  WeeklyPlanTier,
} from "../../modules/subscriptions/entities/weekly-plan.entity";
import { WeeklySubscription } from "../../modules/subscriptions/entities/weekly-subscription.entity";
import { WeeklyPaymentHistory } from "../../modules/subscriptions/entities/weekly-payment-history.entity";
import { User } from "../../modules/users/entities/user.entity";
import { Child } from "../../modules/children/entities/child.entity";
import { ChildModule } from "../../modules/children/entities/child-module.entity";
import { ChildQuest } from "../../modules/children/entities/child-quest.entity";
import { ChildScreen } from "../../modules/children/entities/child-screen.entity";
import { Plan } from "../../modules/subscriptions/entities/plan.entity";
import { UserPlan } from "../../modules/subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../../modules/subscriptions/entities/payment-history.entity";

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User,
    Child,
    ChildModule,
    ChildQuest,
    ChildScreen,
    Plan,
    UserPlan,
    PaymentHistory,
    WeeklyPlan,
    WeeklySubscription,
    WeeklyPaymentHistory,
  ],
  synchronize: false,
  logging: false,
});

const WEEKLY_TIERS: {
  tier: WeeklyPlanTier;
  productName: string;
  weeklyPrice: number;
  totalCycles: number;
  currency: string;
}[] = [
  {
    tier: WeeklyPlanTier.SINGLE,
    productName: "Weekly Plan - Single",
    weeklyPrice: 3399,
    totalCycles: 6,
    currency: "usd",
  },
  {
    tier: WeeklyPlanTier.FAMILY,
    productName: "Weekly Plan - Family",
    weeklyPrice: 4999,
    totalCycles: 6,
    currency: "usd",
  },
];

const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

async function findOrCreatePrice(
  stripe: Stripe.Stripe,
  spec: (typeof WEEKLY_TIERS)[number],
): Promise<any> {
  const products = await stripe.products.search({
    query: `name:'${spec.productName}' AND active:'true'`,
  });
  let product = products.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: spec.productName,
      metadata: { weeklyTier: spec.tier },
    });
    console.log(`✓ Created product: ${spec.productName} (${product.id})`);
  } else {
    console.log(`= Reusing product: ${spec.productName} (${product.id})`);
  }

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  let price = prices.data.find(
    (p) =>
      p.unit_amount === spec.weeklyPrice &&
      p.currency === spec.currency &&
      p.recurring?.interval === "week" &&
      p.recurring?.interval_count === 1,
  );
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: spec.weeklyPrice,
      currency: spec.currency,
      recurring: { interval: "week", interval_count: 1 },
      metadata: { weeklyTier: spec.tier },
    });
    console.log(
      `✓ Created price: ${spec.tier} ${spec.weeklyPrice / 100}/${spec.currency}/week (${price.id})`,
    );
  } else {
    console.log(`= Reusing price: ${spec.tier} (${price.id})`);
  }
  return price;
}

async function ensureWebhookEndpoint(
  stripe: Stripe.Stripe,
  backendUrl: string,
): Promise<void> {
  const url = `${backendUrl.replace(/\/$/, "")}/webhooks/stripe`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((e) => e.url === url);

  if (existing) {
    const missing = REQUIRED_EVENTS.filter(
      (e) => !existing.enabled_events.includes(e),
    );
    if (missing.length === 0) {
      console.log(
        `= Webhook endpoint already has all required events (${existing.id})`,
      );
      return;
    }
    const merged = Array.from(
      new Set([...existing.enabled_events, ...REQUIRED_EVENTS]),
    );
    await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: merged as any,
    });
    console.log(
      `✓ Updated webhook endpoint ${existing.id} — added: ${missing.join(", ")}`,
    );
    return;
  }

  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: REQUIRED_EVENTS as any,
  });
  console.log(`✓ Created webhook endpoint ${created.id} for ${url}`);
  console.log(
    `  NEW webhook secret — set STRIPE_WEBHOOK_SECRET in .env to: ${created.secret}`,
  );
}

async function seed() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
  const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
  if (backendUrl.includes("localhost")) {
    console.log(
      `⚠ BACKEND_URL is "${backendUrl}" — Stripe cannot reach localhost. Skipping webhook endpoint registration; register manually (or via "stripe listen") once a public URL is available.`,
    );
  } else {
    await ensureWebhookEndpoint(stripe, backendUrl);
  }

  await dataSource.initialize();
  if (process.env.NODE_ENV !== "production") {
    await dataSource.synchronize();
  }
  const repo = dataSource.getRepository(WeeklyPlan);

  for (const spec of WEEKLY_TIERS) {
    const price = await findOrCreatePrice(stripe, spec);
    const existing = await repo.findOne({ where: { tier: spec.tier } });
    const values = {
      tier: spec.tier,
      weeklyPrice: spec.weeklyPrice,
      totalCycles: spec.totalCycles,
      currency: spec.currency,
      stripePriceId: price.id,
    };
    if (existing) {
      await repo.update(existing.id, values);
      console.log(`✓ Updated WeeklyPlan: ${spec.tier}`);
    } else {
      await repo.save(repo.create(values));
      console.log(`✓ Created WeeklyPlan: ${spec.tier}`);
    }
  }

  await dataSource.destroy();
  console.log("\nWeekly plans + Stripe products/prices seeded successfully.");
}

seed().catch((err: unknown) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
