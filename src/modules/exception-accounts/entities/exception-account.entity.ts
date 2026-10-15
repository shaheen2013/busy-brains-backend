import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
} from "typeorm";

// Stored as a calendar date (YYYY-MM-DD), exposed as UTC midnight of that day.
const dateOnlyTransformer: ValueTransformer = {
  to: (value?: Date | string | null) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value,
  from: (value?: string | null) =>
    value ? new Date(`${value}T00:00:00.000Z`) : value,
};

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

  /**
   * Day the module unlock schedule starts for this account (the equivalent of
   * a purchase date). Modules then unlock on the normal MODULE_UNLOCK_DAYS
   * stagger from this date.
   */
  @Column({ type: "date", transformer: dateOnlyTransformer })
  moduleUnlockStartDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
