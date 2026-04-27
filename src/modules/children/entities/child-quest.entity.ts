import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { ChildModule } from "./child-module.entity";
import { ChildScreen } from "./child-screen.entity";

@Entity("child_quests")
export class ChildQuest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  moduleId: string;

  @ManyToOne(() => ChildModule, (module) => module.quests)
  @JoinColumn({ name: "moduleId" })
  module: ChildModule;

  @OneToMany(() => ChildScreen, (screen) => screen.quest)
  screens: ChildScreen[];

  @Column({ type: "integer" })
  questNo: number;

  @Column({ type: "boolean", default: false })
  isCompleted: boolean;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
