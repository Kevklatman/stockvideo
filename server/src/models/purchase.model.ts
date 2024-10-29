import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne, 
  CreateDateColumn, 
  UpdateDateColumn 
} from "typeorm";
import { User } from "./user.model";
import { Video } from "./video.model";

@Entity("purchases")
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

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => Video)
  video!: Video;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  completedAt!: Date;
}