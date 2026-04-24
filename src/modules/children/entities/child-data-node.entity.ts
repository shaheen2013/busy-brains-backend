import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Child } from "./child.entity";

export enum DataNodeType {
  MODULE = "module",
  QUEST = "quest",
  SCREEN = "screen",
}

@Entity("child_data_nodes")
export class ChildDataNode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  childId: string;

  @ManyToOne(() => Child, (child) => child.dataNodes)
  @JoinColumn({ name: "childId" })
  child: Child;

  @Column({ type: "integer" })
  moduleNo: number;

  @Column({ type: "integer", nullable: true })
  questNo: number;

  @Column({ type: "integer", nullable: true })
  screenNo: number;

  @Column({ type: "enum", enum: DataNodeType })
  type: DataNodeType;

  @Column({ type: "jsonb", nullable: true })
  data: Record<string, unknown>;

  @Column({ type: "boolean", default: false })
  isCompleted: boolean;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
