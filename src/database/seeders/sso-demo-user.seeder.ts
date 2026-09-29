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

  await dataSource.destroy();
  console.log("\nSSO demo user seeded successfully.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

seed().catch((err: unknown) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
