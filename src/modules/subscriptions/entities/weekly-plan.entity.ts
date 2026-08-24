import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { WeeklySubscription } from "./weekly-subscription.entity";

export enum WeeklyPlanTier {
  SINGLE = "SINGLE",
  FAMILY = "FAMILY",
}

@Entity("weekly_plans")
export class WeeklyPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: WeeklyPlanTier, unique: true })
  tier: WeeklyPlanTier;

  @Column({ type: "integer" })
  weeklyPrice: number;

  @Column({ type: "integer", default: 6 })
  totalCycles: number;

  @Column({ type: "varchar" })
  currency: string;

  @Column({ type: "varchar" })
  stripePriceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => WeeklySubscription, (sub) => sub.weeklyPlan)
  subscriptions: WeeklySubscription[];
}
