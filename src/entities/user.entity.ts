import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryColumn("varchar")
  clerkId: string;

  @Column({ type: "varchar", nullable: true })
  email: string;

  @Column({ type: "varchar", nullable: true })
  firstName: string;

  @Column({ type: "varchar", nullable: true })
  lastName: string;

  @Column({ type: "varchar", nullable: true })
  profileImageUrl: string;

  @Column({ type: "varchar", nullable: true })
  stripeCustomerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
