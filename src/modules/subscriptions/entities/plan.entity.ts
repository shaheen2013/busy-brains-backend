import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { UserPlan } from "./user-plan.entity";

export enum PlanName {
  SOLO_EXPLORER = "SOLO_EXPLORER",
  FAMILY_PACK = "FAMILY_PACK",
}

@Entity("plans")
export class Plan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: PlanName, unique: true })
  name: PlanName;

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
