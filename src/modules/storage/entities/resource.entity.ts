import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { Document } from "./document.entity";

@Entity("resources")
export class Resource {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  entityType: string;

  @Column({ type: "varchar" })
  entityId: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Document, (doc) => doc.resource, {
    cascade: true,
    eager: true,
  })
  documents: Document[];
}
