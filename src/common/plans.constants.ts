import { PlanName } from "../modules/subscriptions/entities/plan.entity";

export const PLANS = {
  SOLO: {
    name: PlanName.SOLO_EXPLORER,
    priceId: process.env.STRIPE_PRICE_SOLO,
  },
  FAMILY: {
    name: PlanName.FAMILY_PACK,
    priceId: process.env.STRIPE_PRICE_FAMILY,
  },
  UPGRADE: {
    priceId: process.env.STRIPE_PRICE_UPGRADE,
  },
};
