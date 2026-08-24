import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { WeeklyPlan } from "./weekly-plan.entity";

export enum WeeklySubscriptionStatus {
  ACTIVE = "active",
  PAST_DUE = "past_due",
  PAID_OFF = "paid_off",
  CANCELED = "canceled",
  INCOMPLETE = "incomplete",
}

@Entity("weekly_subscriptions")
export class WeeklySubscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  weeklyPlanId: string;

  @ManyToOne(() => WeeklyPlan, (plan) => plan.subscriptions)
  @JoinColumn({ name: "weeklyPlanId" })
  weeklyPlan: WeeklyPlan;

  @Column({ type: "varchar", unique: true })
  stripeSubscriptionId: string;

  @Column({
    type: "enum",
    enum: WeeklySubscriptionStatus,
    default: WeeklySubscriptionStatus.INCOMPLETE,
  })
  status: WeeklySubscriptionStatus;

  @Column({ type: "integer", default: 0 })
  cyclesPaid: number;

  @Column({ type: "integer" })
  totalCycles: number;

  @Column({ type: "timestamp", nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  paidOffAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
