export const MAX_MODULES = 6;

/**
 * Days module 1 stays free (from trial start / signup) before it locks
 * for users who haven't purchased a plan.
 */
export const MODULE1_FREE_DAYS = 7;

/**
 * Days after purchasedAt before each module unlocks. All modules require
 * a purchased plan; this only controls the weekly stagger once purchased.
 */

const DEVELOPMENT = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
};

const PRODUCTION = {
  1: 0,
  2: 7,
  3: 14,
  4: 21,
  5: 28,
  6: 35,
};

const developmentMode = process.env.NODE_ENV === "staging";
console.log("developmentMode:", developmentMode);

export const MODULE_UNLOCK_DAYS: Record<number, number> = developmentMode
  ? DEVELOPMENT
  : PRODUCTION;

function parseEmailListEnv(envValue: string | undefined): Set<string> {
  return new Set(
    (envValue ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
  );
}

// Users in this set bypass payment and time-based module gates.
// Sequential completion (previous screen/module must be done) still applies.
// Comma-separated list, e.g. FREE_ACCESS_EMAILS=a@x.com,b@y.com — kept out of
// source so granting/revoking access doesn't require a code change + deploy.
export const FREE_ACCESS_EMAILS = parseEmailListEnv(
  process.env.FREE_ACCESS_EMAILS,
);

/**
 * Manually approved case-by-case exceptions: users confirmed (by checking
 * payment_history) to have paid before MODULE_UNLOCK_DAYS's staggered wait
 * shipped, who'd otherwise be stuck waiting on module 2 for a rule that
 * didn't exist when they bought. Their module 2 unlocks instantly instead
 * of following the standard MODULE_UNLOCK_DAYS[2] delay. Modules 3+ are
 * unaffected. Add an email here only after confirming a succeeded purchase
 * in payment_history — this is not a general grandfather clause.
 * Comma-separated list via env, e.g. MODULE2_INSTANT_UNLOCK_EMAILS=a@x.com,b@y.com
 */
export const MODULE2_INSTANT_UNLOCK_EMAILS = parseEmailListEnv(
  process.env.MODULE2_INSTANT_UNLOCK_EMAILS,
);

/** Resolves the per-module unlock-delay schedule to use for a given user. */
export function getModuleUnlockDays(userEmail: string): Record<number, number> {
  return MODULE2_INSTANT_UNLOCK_EMAILS.has(userEmail)
    ? { ...MODULE_UNLOCK_DAYS, 2: 0 }
    : MODULE_UNLOCK_DAYS;
}
