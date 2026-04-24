import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { UserPlan } from "./user-plan.entity";

@Entity("plans")
export class Plan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "integer" })
  price: number;

  @Column({ type: "integer" })
  maxChildren: number;

  @Column({ type: "varchar" })
  stripePriceId: string;

  @Column({ type: "varchar" })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => UserPlan, (userPlan) => userPlan.plan)
  userPlans: UserPlan[];
}
