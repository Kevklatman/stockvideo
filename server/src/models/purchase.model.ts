// src/models/purchase.model.ts
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
import { Video } from "./video.model";

@Entity("purchases")
@Index(["userId"])
@Index(["videoId"])
@Index(["userId", "videoId"])
export class Purchase {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  userId!: string;

  @Column()
  videoId!: string;

  @Column("decimal", { precision: 10, scale: 2 })
  amount!: number;

  @Column({
    type: "enum",
    enum: ["pending", "completed", "failed"],
    default: "pending"
  })
  status!: "pending" | "completed" | "failed";

  @Column({ nullable: true })
  stripePaymentId!: string;

  @ManyToOne(() => User, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE"
  })
  @JoinColumn({ 
    name: "userId",
    referencedColumnName: "id",
    foreignKeyConstraintName: "FK_purchase_user"
  })
  user!: User;

  @ManyToOne(() => Video, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE"
  })
  @JoinColumn({ 
    name: "videoId",
    referencedColumnName: "id",
    foreignKeyConstraintName: "FK_purchase_video"
  })
  video!: Video;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true, type: 'timestamp' })
  completedAt!: Date;
}