import { Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Stripe } from 'stripe';

// Core Domain Types
export interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}
export interface Logger {
  child(metadata: Record<string, any>): Logger;
  info(message: string, metadata?: Record<string, any>): void;
  error(message: string, metadata?: Record<string, any>): void;
}

export interface PurchaseHistoryItem {
  id: string;
  videoId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  video: {
    title: string;
    thumbnailUrl: string;
    fullVideoUrl?: string;
    streamingUrl?: string;
    previewUrl?: string;
  };
}

export interface PurchaseHistoryResponse {
  purchases: PurchaseHistoryItem[];
  total: number;
  page: number;
  pages: number;
}
export interface Video {
  id: string;
  title: string;
  description: string;
  price: number;           // in dollars
  previewUrl: string;
  fullVideoUrl: string;
  thumbnailUrl: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface Purchase {
  id: string;
  userId: string;
  videoId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  stripePaymentId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
// Status Types
export interface PurchaseStatus {
  status: 'pending' | 'completed' | 'failed';
  message?: string;
}

// Express Types
export interface VideoRequestParams {
  videoId: string;
  [key: string]: string | undefined;
}

export interface StreamQueryParams {
  token?: string;
  [key: string]: string | undefined;
}

export interface VideoResponseLocals {
  previewUrl?: string;
  streamingToken?: string;
  downloadToken?: string;
  streamUrl?: string;
  range?: string;
  isOwner?: boolean;
  hasFullAccess?: boolean;
  isVideoOwner?: boolean;
  preferredFormat?: 'hls' | 'mp4';
}

export interface VideoRequest extends Request<VideoRequestParams, any, any, StreamQueryParams> {}
export interface VideoResponse extends Response<any, VideoResponseLocals> {}

export interface AuthenticatedRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> 
extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: User;
}

export interface AuthenticatedVideoRequest extends AuthenticatedRequest<VideoRequestParams, any, any, StreamQueryParams> {}

// Payment Types
export interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
  purchaseId: string;
  paymentIntentId: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  amount: number;         // in dollars
  currency: string;
  status?: string;
  purchaseId: string;
  paymentIntentId: string;
}
export interface VerificationResult {
  verified: boolean;
  purchase?: {
    id: string;
    status: 'pending' | 'completed' | 'failed';
    completedAt?: string;
  };
}


export interface PaymentMeta {
  purchaseId: string;
  videoId: string;
  userId: string;
  stripePurchaseId:string;
}

export interface PaymentVerificationResponse {
  verified: boolean;
  purchase?: {
    id: string;
    status: 'pending' | 'completed' | 'failed';
    completedAt?: string; // ISO string format
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
}

// Component Props Types

// Video Processing Types
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

export interface VideoUploadResult {
  previewUrl: string;
  thumbnailUrl: string;
  qualityUrls: {
    [key: string]: string;
  };
}

// Access Control Types
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

export interface VideoAccessVerification {
  canAccess: boolean;
  isOwner: boolean;
  purchaseRequired: boolean;
  purchaseStatus?: 'not_purchased' | 'pending' | 'completed';
}

// API Response Types
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Configuration Types
export interface FrontendConfig {
  stripePublishableKey: string;
  apiUrl: string;
  uploadLimits: {
    maxFileSize: number;
    allowedTypes: string[];
  };
}

export interface StripeConfig {
  publicKey: string;
  apiVersion: string;
  webhookSecret: string;
  currency: string;
  paymentMethods: string[];
}

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

// Stripe Types
export interface StripeWebhookPayload {
  id: string;
  object: string;
  type: string;
  data: {
    object: Stripe.PaymentIntent;
  };
}

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  amount: number;         // in cents (Stripe format)
  currency: string;
  status: string;
  metadata: {
    purchaseId?: string;
    videoId?: string;
    userId?: string;
    stripePaymentId?: string;
  };
}

// Error Classes
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