import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { ChildModule } from "./child-module.entity";

@Entity("children")
export class Child {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  userId: string;

  @ManyToOne(() => User, (user) => user.children)
  @JoinColumn({ name: "userId" })
  user: User;

  @OneToMany(() => ChildModule, (module) => module.child, {
    cascade: true,
    onDelete: "CASCADE",
  })
  modules: ChildModule[];

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "integer" })
  age: number;

  @Column({ type: "varchar" })
  gender: string;

  @Column({ type: "varchar", nullable: true, default: null })
  profileImage: string | null;

  @Column({ type: "varchar", default: "image" })
  avatar_type: "avatar" | "prebuilt" | "image";

  @Column({ type: "varchar", nullable: true, default: null })
  prebuilt_buddy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
