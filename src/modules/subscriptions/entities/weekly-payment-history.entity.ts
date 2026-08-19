import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { WeeklySubscription } from "./weekly-subscription.entity";
import { WeeklyPlanTier } from "./weekly-plan.entity";

export enum WeeklyPaymentType {
  CYCLE = "cycle",
  PAYOFF = "payoff",
  UPGRADE = "upgrade",
}

export enum WeeklyPaymentStatus {
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  PENDING = "pending",
}

@Entity("weekly_payment_history")
export class WeeklyPaymentHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  weeklySubscriptionId: string;

  @ManyToOne(() => WeeklySubscription)
  @JoinColumn({ name: "weeklySubscriptionId" })
  weeklySubscription: WeeklySubscription;

  @Column({ type: "varchar", unique: true, nullable: true })
  stripeInvoiceId: string | null;

  @Column({ type: "varchar", nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ type: "integer", nullable: true })
  cycleNumber: number | null;

  @Column({ type: "integer" })
  amount: number;

  @Column({ type: "varchar" })
  currency: string;

  @Column({ type: "enum", enum: WeeklyPaymentStatus })
  status: WeeklyPaymentStatus;

  @Column({ type: "enum", enum: WeeklyPaymentType })
  type: WeeklyPaymentType;

  @Column({ type: "enum", enum: WeeklyPlanTier, nullable: true })
  fromTier: WeeklyPlanTier | null;

  @Column({ type: "enum", enum: WeeklyPlanTier, nullable: true })
  toTier: WeeklyPlanTier | null;

  @Column({ type: "varchar", nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
