// server/src/config/database.ts
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Log database configuration
console.log('Database configuration:', {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  // Also log AWS config to verify it's loaded
  bucket: process.env.AWS_BUCKET_NAME
});

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV !== "production",
  entities: ["src/models/**/*.ts"],
  migrations: ["src/migrations/**/*.ts"],
  subscribers: ["src/subscribers/**/*.ts"],
});