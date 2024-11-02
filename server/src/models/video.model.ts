// src/models/video.model.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  ManyToOne,
  JoinColumn,
  CreateDateColumn, 
  UpdateDateColumn,
  Index,
  ValueTransformer
} from "typeorm";
import { User } from "./user.model";

// Price transformer to handle decimal/number conversion
const priceTransformer: ValueTransformer = {
  to: (value: number): number => {
    if (typeof value !== 'number') {
      return 0;
    }
    return value;
  },
  from: (value: string | null): number => {
    if (value === null) {
      return 0;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
};

@Entity("videos")
@Index(["userId"])
export class Video {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  title!: string;

  @Column("text", { nullable: true })
  description!: string;

  @Column("decimal", { 
    precision: 10, 
    scale: 2,
    transformer: priceTransformer,
    default: 0
  })
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

  // Helper method to get formatted price
  getFormattedPrice(): string {
    return this.price.toFixed(2);
  }

  // Helper method to validate price
  validatePrice(): boolean {
    return typeof this.price === 'number' && 
           !isNaN(this.price) && 
           this.price >= 0 && 
           this.price <= 1000000; // Example max price limit
  }
}