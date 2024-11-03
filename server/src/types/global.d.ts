// src/types/global.d.ts
import { Express } from 'express';

declare module 'express' {
  export interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
    };
    rawBody?: Buffer;
  }
}

declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        // Server
        PORT?: string;
        NODE_ENV?: 'development' | 'production' | 'test';
        
        // Database
        DB_HOST?: string;
        DB_PORT?: string;
        DB_USER?: string;
        DB_PASSWORD?: string;
        DB_NAME?: string;
        
        // JWT
        JWT_SECRET?: string;
        JWT_STREAMING_SECRET?: string;
        
        // AWS
        AWS_ACCESS_KEY_ID?: string;
        AWS_SECRET_ACCESS_KEY?: string;
        AWS_REGION?: string;
        AWS_BUCKET_NAME?: string;
        
        // Redis
        REDIS_HOST?: string;
        REDIS_PORT?: string;
        REDIS_PASSWORD?: string;
        
        // Stripe
        STRIPE_SECRET_KEY?: string;
        STRIPE_WEBHOOK_SECRET?: string;
        STRIPE_PUBLISHABLE_KEY?: string;
        
        // Frontend
        FRONTEND_URL?: string;
        ALLOWED_ORIGINS?: string;
      }
    }
  }
}