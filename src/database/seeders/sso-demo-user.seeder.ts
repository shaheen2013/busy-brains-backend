import { DataSource } from "typeorm";
import { createClerkClient } from "@clerk/backend";
import { User } from "../../modules/users/entities/user.entity";
import { Child } from "../../modules/children/entities/child.entity";
import { ChildModule } from "../../modules/children/entities/child-module.entity";
import { ChildQuest } from "../../modules/children/entities/child-quest.entity";
import { ChildScreen } from "../../modules/children/entities/child-screen.entity";
import { Plan } from "../../modules/subscriptions/entities/plan.entity";
import { UserPlan } from "../../modules/subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../../modules/subscriptions/entities/payment-history.entity";
import { PLANS } from "../../common/plans.constants";

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // TypeORM needs every entity User has a relation to (children, userPlans,
  // payments) registered here too, even though this seeder never touches them.
  entities: [
    User,
    Child,
    ChildModule,
    ChildQuest,
    ChildScreen,
    Plan,
    UserPlan,
    PaymentHistory,
  ],
  synchronize: false,
  logging: false,
});

const email = process.env.SSO_DEMO_EMAIL || "demo@busy-brains.com.au";
const name = process.env.SSO_DEMO_NAME || "Demo Parent";
// 8+ chars, mixed upper/lower/number/special, per the SSO seed rules.
const password = process.env.SSO_DEMO_PASSWORD || "Demo@BusyBrains26!";

// The maximum plan, so the demo account can add up to 3 children and exercise
// every plan-gated feature without hitting the "upgrade to add more" wall.
const FAMILY_PLAN = {
  name: PLANS.FAMILY.name,
  price: 30000,
  maxChildren: 3,
  currency: "aud",
  stripePriceId: PLANS.FAMILY.priceId || "price_demo_family_pack",
};

const DEMO_CHILD = {
  name: "Buddy",
  age: 8,
  gender: "preferNotToSay",
  avatar_type: "avatar" as const,
};

async function seed() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is missing");
  }

  const clerkClient = createClerkClient({ secretKey });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  const existingUsers = await clerkClient.users.getUserList({
    emailAddress: [email],
  });

  let clerkUserId: string;
  if (existingUsers.totalCount > 0) {
    clerkUserId = existingUsers.data[0].id;
    await clerkClient.users.updateUser(clerkUserId, { password });
    console.log(`Updated password for existing Clerk user: ${clerkUserId}`);
  } else {
    const newClerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      firstName: name,
      password,
    });
    clerkUserId = newClerkUser.id;
    console.log(`Created Clerk user: ${clerkUserId}`);
  }

  const existing = await userRepo.findOne({ where: { id: clerkUserId } });
  if (existing) {
    await userRepo.update(existing.id, {
      name,
      email,
      hasPassword: true,
      isDeleted: false,
    });
    console.log(`Updated DB user: ${clerkUserId}`);
  } else {
    await userRepo.save(
      userRepo.create({
        id: clerkUserId,
        name,
        email,
        hasPassword: true,
        isDeleted: false,
        appGuideShown: false,
      }),
    );
    console.log(`Created DB user: ${clerkUserId}`);
  }

  // Ensure the demo user has the maximum plan active, so the demo showcases
  // multi-child support and every plan-gated feature.
  const planRepo = dataSource.getRepository(Plan);
  let plan = await planRepo.findOne({ where: { name: FAMILY_PLAN.name } });
  if (!plan) {
    plan = await planRepo.save(planRepo.create(FAMILY_PLAN));
    console.log(`Created plan: ${plan.name}`);
  }

  const userPlanRepo = dataSource.getRepository(UserPlan);
  let userPlan = await userPlanRepo.findOne({
    where: { userId: clerkUserId, isActive: true },
  });

  if (userPlan) {
    await userPlanRepo.update(userPlan.id, {
      planId: plan.id,
      isTrial: false,
      isActive: true,
      purchasedAt: new Date(),
    });
    console.log(`Updated active plan for demo user: ${plan.name}`);
  } else {
    await userPlanRepo.save(
      userPlanRepo.create({
        userId: clerkUserId,
        planId: plan.id,
        isTrial: false,
        isActive: true,
        purchasedAt: new Date(),
      }),
    );
    console.log(`Assigned plan to demo user: ${plan.name}`);
  }

  // Give the demo user one child, so the dashboard/progress views have
  // something to show instead of an empty "add a child" state.
  const childRepo = dataSource.getRepository(Child);
  const existingChild = await childRepo.findOne({
    where: { userId: clerkUserId, name: DEMO_CHILD.name },
  });

  if (!existingChild) {
    await childRepo.save(childRepo.create({ userId: clerkUserId, ...DEMO_CHILD }));
    console.log(`Created demo child: ${DEMO_CHILD.name}`);
  } else {
    console.log(`Demo child already exists: ${DEMO_CHILD.name}`);
  }

  await dataSource.destroy();
  console.log("\nSSO demo user seeded successfully.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Plan: ${plan.name} (max ${plan.maxChildren} children)`);
  console.log(`Child: ${DEMO_CHILD.name}`);
}

seed().catch((err: unknown) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
