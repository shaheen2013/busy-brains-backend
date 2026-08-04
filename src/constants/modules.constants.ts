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

// Users in this set bypass payment and time-based module gates.
// Sequential completion (previous screen/module must be done) still applies.
export const FREE_ACCESS_EMAILS = new Set([
  "shaheenmediusware@gmail.com",
  "mdmarufbinsalimbhuiyan@gmail.com",
  "aileenk00@gmail.com",
]);
