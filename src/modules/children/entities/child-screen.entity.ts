import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { ChildQuest } from "./child-quest.entity";

@Entity("child_screens")
export class ChildScreen {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  questId: string;

  @ManyToOne(() => ChildQuest, (quest) => quest.screens)
  @JoinColumn({ name: "questId" })
  quest: ChildQuest;

  @Column({ type: "integer" })
  screenNo: number;

  @Column({ type: "jsonb", nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: "boolean", default: false })
  isCompleted: boolean;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
