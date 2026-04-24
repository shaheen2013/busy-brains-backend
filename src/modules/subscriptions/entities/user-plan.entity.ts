import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Plan } from "./plan.entity";

@Entity("user_plans")
export class UserPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  userId: string;

  @ManyToOne(() => User, (user) => user.userPlans)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  planId: string;

  @ManyToOne(() => Plan, (plan) => plan.userPlans)
  @JoinColumn({ name: "planId" })
  plan: Plan;

  @Column({ type: "boolean", default: false })
  isTrial: boolean;

  @Column({ type: "timestamp", nullable: true })
  trialStartedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  trialEndsAt: Date;

  @Column({ type: "boolean", default: false })
  isActive: boolean;

  @Column({ type: "timestamp", nullable: true })
  purchasedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
