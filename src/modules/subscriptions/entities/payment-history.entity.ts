import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { UserPlan } from "./user-plan.entity";
import { Plan } from "./plan.entity";

@Entity("payment_history")
export class PaymentHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  userId: string;

  @ManyToOne(() => User, (user) => user.payments)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  paymentId: string;

  @ManyToOne(() => UserPlan)
  @JoinColumn({ name: "paymentId" })
  userPlan: UserPlan;

  @Column({ type: "uuid" })
  planId: string;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: "planId" })
  plan: Plan;

  @Column({ type: "integer" })
  amount: number;

  @Column({ type: "varchar" })
  currency: string;

  @Column({ type: "varchar" })
  stripePaymentIntentId: string;

  @Column({ type: "varchar" })
  stripeCheckoutSessionId: string;

  @Column({ type: "varchar" })
  status: string;

  @Column({ type: "varchar", nullable: true })
  invoicePdfUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
