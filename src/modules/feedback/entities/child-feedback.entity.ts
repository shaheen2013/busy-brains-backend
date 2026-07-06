import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Child } from "../../children/entities/child.entity";

// Two feedback records per child: one by parent (byChild=false) and one by child (byChild=true).
@Entity("child_feedback")
@Unique(["childId", "byChild"])
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

  // True if the feedback was submitted by the child themselves; false (or null) if by the parent.
  @Column({ type: "boolean", default: false })
  byChild: boolean;

  // Set to the current time on every submit (create or update).
  @Column({ type: "timestamp" })
  submittedAt: Date;
}
