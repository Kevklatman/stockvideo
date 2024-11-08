// src/types/index.d.ts
import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Stripe } from 'stripe';

// Extend Express Request
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Environment variables type
export interface ProcessEnv {
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

// Frontend related types
export interface FrontendConfig {
  stripePublishableKey: string;
  apiUrl: string;
  uploadLimits: {
    maxFileSize: number;
    allowedTypes: string[];
  };
}

// Video related types
export interface VideoPreset {
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
}

export interface ProcessedVideo {
  preview: string;
  thumbnail: string;
  qualities: {
    [key: string]: string;
  };
  duration: number;
}

export interface StreamingToken extends JwtPayload {
  videoId: string;
  userId: string;
  type: string;
}

export interface DownloadToken {
  videoId: string;
  userId: string;
  expiresAt: number;
}

// Payment related types
export interface PaymentMeta {
  purchaseId: string;
  videoId: string;
  userId: string;
}

export interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

export interface PaymentResult {
  success: boolean;
  error?: {
    message: string;
    code: string;
  };
  paymentIntentId?: string;
  purchaseId?: string;
  stripePaymentId:string;
}

export interface VideoUploadResult {
  previewUrl: string;
  thumbnailUrl: string;
  qualityUrls: {
    [key: string]: string;
  };
}

export interface PurchaseStatus {
  status: 'pending' | 'completed' | 'failed'| 'cancelled'| 'payment_failed';
  message?: string;
}


// Stripe related types
export interface StripeWebhookPayload {
  id: string;
  object: string;
  type: string;
  data: {
    object: Stripe.PaymentIntent;
  };
}

export interface StripeConfig {
  publicKey: string;
  apiVersion: string;
  webhookSecret: string;
  currency: string;
  paymentMethods: string[];
}

// Redis related types
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  keyPrefix: string;
}

export interface CacheConfig {
  ttl: number;
  prefix: string;
}

// Error classes
export abstract class BaseError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class VideoProcessingError extends BaseError {
  constructor(message: string) {
    super(message, 'VIDEO_PROCESSING_ERROR');
  }
}

export class PaymentError extends BaseError {
  constructor(message: string) {
    super(message, 'PAYMENT_ERROR');
  }
}

export class VideoAccessError extends BaseError {
  constructor(message: string) {
    super(message, 'VIDEO_ACCESS_ERROR');
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class StorageError extends BaseError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR');
  }
}

