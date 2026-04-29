import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Child } from "./child.entity";
import { ChildQuest } from "./child-quest.entity";

@Entity("child_modules")
export class ChildModule {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  childId: string;

  @ManyToOne(() => Child, (child) => child.modules)
  @JoinColumn({ name: "childId" })
  child: Child;

  @OneToMany(() => ChildQuest, (quest) => quest.module, { cascade: true, onDelete: "CASCADE" })
  quests: ChildQuest[];

  @Column({ type: "integer" })
  moduleNo: number;

  @Column({ type: "boolean", default: false })
  isCompleted: boolean;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
