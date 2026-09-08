import { DataSource } from "typeorm";
import { User } from "../../modules/users/entities/user.entity";
import { Child } from "../../modules/children/entities/child.entity";
import { ChildModule } from "../../modules/children/entities/child-module.entity";
import { ChildQuest } from "../../modules/children/entities/child-quest.entity";
import { ChildScreen } from "../../modules/children/entities/child-screen.entity";
import { ChildFeedback } from "../../modules/feedback/entities/child-feedback.entity";
import { Plan } from "../../modules/subscriptions/entities/plan.entity";
import { UserPlan } from "../../modules/subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../../modules/subscriptions/entities/payment-history.entity";
import { WeeklyPlan } from "../../modules/subscriptions/entities/weekly-plan.entity";
import { WeeklySubscription } from "../../modules/subscriptions/entities/weekly-subscription.entity";
import { WeeklyPaymentHistory } from "../../modules/subscriptions/entities/weekly-payment-history.entity";
import { Resource } from "../../modules/storage/entities/resource.entity";
import { Document } from "../../modules/storage/entities/document.entity";
import { VerificationToken } from "../../modules/users/entities/verification-token.entity";

/**
 * One-off, run-once-by-hand schema sync for the weekly-payments feature.
 * Production always runs with `synchronize: false` (no migration files exist
 * in this repo — every schema change so far has gone through staging's
 * synchronize:true), so this mirrors database.config.ts's full entity list
 * and calls synchronize() unconditionally to bring an existing production
 * database up to date before the new backend code (which queries
 * weekly_plans/weekly_subscriptions/weekly_payment_history unconditionally
 * on every /users/me call) starts serving traffic. Only additive changes
 * are expected (new tables, new columns, new enum values) since nothing
 * has been renamed or dropped.
 */
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
    ChildFeedback,
    Plan,
    UserPlan,
    PaymentHistory,
    WeeklyPlan,
    WeeklySubscription,
    WeeklyPaymentHistory,
    Resource,
    Document,
    VerificationToken,
  ],
  synchronize: false,
  logging: true,
});

async function run() {
  await dataSource.initialize();
  console.log("Connected. Running synchronize()...");
  await dataSource.synchronize();
  console.log("Schema sync complete.");
  await dataSource.destroy();
}

run().catch((err: unknown) => {
  console.error("Schema sync failed:", err);
  process.exit(1);
});
