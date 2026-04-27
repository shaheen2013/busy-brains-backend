import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { Child } from "../../children/entities/child.entity";
import { UserPlan } from "../../subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../../subscriptions/entities/payment-history.entity";

@Entity("users")
export class User {
  @PrimaryColumn("varchar")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", unique: true })
  email: string;

  @Column({ type: "varchar", nullable: true })
  phone: string;

  @Column({ type: "varchar", nullable: true })
  location: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Child, (child) => child.user)
  children: Child[];

  @OneToMany(() => UserPlan, (userPlan) => userPlan.user)
  userPlans: UserPlan[];

  @OneToMany(() => PaymentHistory, (payment) => payment.user)
  payments: PaymentHistory[];
}
