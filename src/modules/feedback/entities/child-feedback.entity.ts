import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Child } from "../../children/entities/child.entity";

// One feedback record per child. Re-submitting upserts this row.
@Entity("child_feedback")
@Unique(["childId"])
export class ChildFeedback {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  childId: string;

  @ManyToOne(() => Child, { onDelete: "CASCADE" })
  @JoinColumn({ name: "childId" })
  child: Child;

  @Column({ type: "jsonb" })
  feedback: Record<string, unknown>;

  // Set to the current time on every submit (create or update).
  @Column({ type: "timestamp" })
  submittedAt: Date;
}
