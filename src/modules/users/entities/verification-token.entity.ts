import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum VerificationType {
  ACCOUNT_DELETION = "ACCOUNT_DELETION",
  CHILD_DELETION = "CHILD_DELETION",
}

@Entity("verification_tokens")
export class VerificationToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({
    type: "enum",
    enum: VerificationType,
  })
  type: VerificationType;

  @Column()
  otpHash: string;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
