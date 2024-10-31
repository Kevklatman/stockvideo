// src/models/user.model.ts
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index,
  BeforeInsert
} from "typeorm";
import bcrypt from "bcryptjs";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  @Index()
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: "user" })
  role!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @BeforeInsert()
  async hashPassword() {
    if (this.passwordHash) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash);
  }
}