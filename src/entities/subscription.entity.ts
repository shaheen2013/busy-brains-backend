import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("subscriptions")
export class Subscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar")
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "varchar", nullable: true })
  stripeSubscriptionId: string;

  @Column({ type: "varchar", nullable: true })
  stripePriceId: string;

  @Column({
    type: "varchar",
    nullable: true,
  })
  planType: "single" | "family";

  @Column({
    type: "varchar",
    default: "inactive",
  })
  status: string;

  @Column({ type: "timestamp", nullable: true })
  startDate: Date;

  @Column({ type: "timestamp", nullable: true })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
