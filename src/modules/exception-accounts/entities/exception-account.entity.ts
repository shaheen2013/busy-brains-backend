import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Enterprise accounts that pay outside the system. Matched by email at
 * request time, so a row works even if the user signs up later.
 * Emails are stored lowercase and trimmed.
 */
@Entity("exception_accounts")
export class ExceptionAccount {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", unique: true })
  email: string;

  @Column({ type: "integer" })
  childAllowed: number;

  @Column({ type: "boolean", default: true })
  exceptionGiven: boolean;

  @Column({ type: "text" })
  billingDescription: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
