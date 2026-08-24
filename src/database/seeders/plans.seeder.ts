import { DataSource } from "typeorm";
import { Plan } from "../../modules/subscriptions/entities/plan.entity";
import { UserPlan } from "../../modules/subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../../modules/subscriptions/entities/payment-history.entity";
import { User } from "../../modules/users/entities/user.entity";
import { Child } from "../../modules/children/entities/child.entity";
import { ChildModule } from "../../modules/children/entities/child-module.entity";
import { ChildQuest } from "../../modules/children/entities/child-quest.entity";
import { ChildScreen } from "../../modules/children/entities/child-screen.entity";
import { PLANS } from "../../common/plans.constants";

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
  ],
  synchronize: false,
  logging: false,
});

const plans: Omit<Plan, "id" | "createdAt" | "userPlans">[] = [
  {
    name: PLANS.SOLO.name,
    price: 19900,
    maxChildren: 1,
    currency: "aud",
    stripePriceId: PLANS.SOLO.priceId,
  },
  {
    name: PLANS.FAMILY.name,
    price: 30000,
    maxChildren: 3,
    currency: "aud",
    stripePriceId: PLANS.FAMILY.priceId,
  },
];

async function seed() {
  await dataSource.initialize();

  const repo = dataSource.getRepository(Plan);

  for (const plan of plans) {
    const existing = await repo.findOne({ where: { name: plan.name } });
    if (existing) {
      await repo.update(existing.id, plan);
      console.log(`✓ Updated: ${plan.name}`);
    } else {
      await repo.save(repo.create(plan));
      console.log(`✓ Created: ${plan.name}`);
    }
  }

  await dataSource.destroy();
  console.log("\nPlans seeded successfully.");
}

seed().catch((err: unknown) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
