import { DataSource, Repository } from "typeorm";
import { User } from "../../src/modules/users/entities/user.entity";
import {
  Plan,
  PlanName,
} from "../../src/modules/subscriptions/entities/plan.entity";
import { UserPlan } from "../../src/modules/subscriptions/entities/user-plan.entity";
import {
  VerificationToken,
  VerificationType,
} from "../../src/modules/users/entities/verification-token.entity";
import bcrypt from "bcrypt";

/** Truncate all non-seed tables between tests. */
export async function cleanDatabase(ds: DataSource): Promise<void> {
  // Disable FK checks, truncate in any order, re-enable
  await ds.query(`
    TRUNCATE TABLE
      child_screens,
      child_quests,
      child_modules,
      children,
      verification_tokens,
      payment_history,
      user_plans,
      documents,
      resources,
      users
    RESTART IDENTITY CASCADE
  `);
}

/** Ensure the two plan rows exist (idempotent). */
export async function seedPlans(ds: DataSource): Promise<void> {
  const repo: Repository<Plan> = ds.getRepository(Plan);
  const existing = await repo.count();
  if (existing >= 2) return;

  await repo.save([
    repo.create({
      name: PlanName.SOLO_EXPLORER,
      price: 4900,
      maxChildren: 1,
      stripePriceId: "price_solo_test",
      currency: "aud",
    }),
    repo.create({
      name: PlanName.FAMILY_PACK,
      price: 7900,
      maxChildren: 4,
      stripePriceId: "price_family_test",
      currency: "aud",
    }),
  ]);
}

/** Create a user row directly in the DB and return it. */
export async function createUser(
  ds: DataSource,
  overrides: Partial<User> = {},
): Promise<User> {
  const repo: Repository<User> = ds.getRepository(User);
  return repo.save(
    repo.create({
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      name: "Test User",
      hasPassword: false,
      isDeleted: false,
      ...overrides,
    }),
  );
}

/** Give a user an active trial plan. */
export async function giveUserTrial(
  ds: DataSource,
  userId: string,
): Promise<UserPlan> {
  const repo: Repository<UserPlan> = ds.getRepository(UserPlan);
  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);
  return repo.save(
    repo.create({
      userId,
      isTrial: true,
      isActive: true,
      trialStartedAt: now,
      trialEndsAt,
    }),
  );
}

/** Give a user an active paid plan. */
export async function giveUserPaidPlan(
  ds: DataSource,
  userId: string,
  planName: PlanName = PlanName.SOLO_EXPLORER,
): Promise<UserPlan> {
  const planRepo: Repository<Plan> = ds.getRepository(Plan);
  const plan = await planRepo.findOne({ where: { name: planName } });
  const repo: Repository<UserPlan> = ds.getRepository(UserPlan);
  return repo.save(
    repo.create({
      userId,
      planId: plan.id,
      isTrial: false,
      isActive: true,
      purchasedAt: new Date(),
    }),
  );
}

/** Create a valid OTP token in the DB and return the raw OTP string. */
export async function createOtp(
  ds: DataSource,
  userId: string,
  type: VerificationType,
): Promise<string> {
  const otp = "123456";
  const otpHash = await bcrypt.hash(otp, 10);
  const repo: Repository<VerificationToken> =
    ds.getRepository(VerificationToken);
  await repo.save(
    repo.create({
      userId,
      type,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
    }),
  );
  return otp;
}
