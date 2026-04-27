export const MAX_MODULES = 6;

/**
 * Days after purchasedAt before each module unlocks.
 * Index 0 = module 1 (always free), index 1 = module 2, etc.
 */
export const MODULE_UNLOCK_DAYS: Record<number, number> = {
  1: 0, // always unlocked — purchasedAt not required
  2: 0, // unlocks immediately on purchase
  3: 14,
  4: 28,
  5: 42,
  6: 56,
};
