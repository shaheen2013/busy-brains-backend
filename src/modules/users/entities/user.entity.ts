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
  phoneNumber: string | null;

  @Column({ type: "varchar", nullable: true })
  country: string | null;

  @Column({ type: "varchar", nullable: true })
  state: string | null;

  @Column({ type: "varchar", nullable: true })
  timezone: string | null;

  @Column({ type: "int", nullable: true })
  age: number | null;

  @Column({ type: "varchar", nullable: true })
  zipcode: string | null;

  @Column({ type: "boolean", default: false })
  hasPassword: boolean;

  @Column({ type: "boolean", default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Child, (child) => child.user)
  children: Child[];

  @OneToMany(() => UserPlan, (userPlan) => userPlan.user)
  userPlans: UserPlan[];

  @OneToMany(() => PaymentHistory, (payment) => payment.user)
  payments: PaymentHistory[];
}
