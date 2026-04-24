import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { ChildDataNode } from "./child-data-node.entity";

@Entity("children")
export class Child {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  userId: string;

  @ManyToOne(() => User, (user) => user.children)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "integer" })
  age: number;

  @Column({ type: "varchar" })
  gender: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => ChildDataNode, (node) => node.child)
  dataNodes: ChildDataNode[];
}
