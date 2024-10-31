// src/models/video.model.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne,
  JoinColumn,
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from "typeorm";
import { User } from "./user.model";

@Entity("videos")
@Index(["userId"])
export class Video {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  title!: string;

  @Column("text", { nullable: true })
  description!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  price!: number;

  @Column()
  previewUrl!: string;

  @Column()
  fullVideoUrl!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { 
    onDelete: "CASCADE",
    onUpdate: "CASCADE" 
  })
  @JoinColumn({ 
    name: "userId",
    referencedColumnName: "id",
    foreignKeyConstraintName: "FK_video_user"
  })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}