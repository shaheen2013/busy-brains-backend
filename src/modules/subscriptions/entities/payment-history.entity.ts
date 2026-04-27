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

  @Column({ type: "varchar", nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.payments, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: User | null;

  @Column({ type: "uuid", nullable: true })
  paymentId: string | null;

  @ManyToOne(() => UserPlan, { nullable: true })
  @JoinColumn({ name: "paymentId" })
  userPlan: UserPlan | null;

  @Column({ type: "uuid", nullable: true })
  planId: string | null;

  @ManyToOne(() => Plan, { nullable: true })
  @JoinColumn({ name: "planId" })
  plan: Plan | null;

  @Column({ type: "integer", nullable: true })
  amount: number | null;

  @Column({ type: "varchar", nullable: true })
  currency: string | null;

  @Column({ type: "varchar", unique: true })
  stripePaymentIntentId: string;

  @Column({ type: "varchar", nullable: true })
  stripeCheckoutSessionId: string | null;

  @Column({ type: "varchar" })
  status: string;

  @Column({ type: "varchar", nullable: true })
  invoicePdfUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
