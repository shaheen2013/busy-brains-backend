export const MAX_MODULES = 6;

/**
 * Days after purchasedAt before each module unlocks.
 * Index 0 = module 1 (always free), index 1 = module 2, etc.
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
  2: 0,
  3: 14,
  4: 28,
  5: 42,
  6: 56,
};

const developmentMode = true;

export const MODULE_UNLOCK_DAYS: Record<number, number> = developmentMode
  ? DEVELOPMENT
  : PRODUCTION;
