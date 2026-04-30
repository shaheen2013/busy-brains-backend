import { PlanName } from "../modules/subscriptions/entities/plan.entity";

export const PLANS = {
  SOLO: {
    name: PlanName.SOLO_EXPLORER,
    priceId: "price_1TQjwu81Q1UwBp8wv6EJ2Yxx",
  },
  FAMILY: {
    name: PlanName.FAMILY_PACK,
    priceId: "price_1TQjxG81Q1UwBp8wjkijtzww",
  },
  UPGRADE: {
    // $100 difference price for Solo Explorer → Family Pack upgrade
    priceId: "price_1TRv8Q81Q1UwBp8wpsHRsaHT",
  },
};
