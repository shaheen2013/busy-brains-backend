import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Resource } from "./resource.entity";

@Entity("documents")
export class Document {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  resourceId: string;

  @Column({ type: "varchar" })
  key: string;

  @Column({ type: "varchar" })
  url: string;

  @Column({ type: "varchar" })
  mimeType: string;

  @Column({ type: "varchar", nullable: true })
  label: string | null;

  @Column({ type: "int" })
  size: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Resource, (resource) => resource.documents, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "resourceId" })
  resource: Resource;
}
