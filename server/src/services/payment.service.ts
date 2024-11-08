// src/services/payment.service.ts
import Stripe from 'stripe';
import { AppDataSource } from "../config/database";
import { Purchase } from "../models/purchase.model";
import { Video } from "../models/video.model";
import { User } from "../models/user.model";
import { PaymentError } from "../types/errors";
import { PaymentIntent, PaymentIntentResponse, PurchaseStatus, ValidationError } from "../types";
import { Logger } from "../utils/logger";
import redisClient from '../config/redis';
import { toCents, isValidPrice, parsePrice } from '../utils/price';
import { IsNull, Not } from 'typeorm';
import { VideoService } from './video.service'; // Ensure you import VideoService

export class PaymentService {
  private static purchaseRepository = AppDataSource.getRepository(Purchase);
  private static videoRepository = AppDataSource.getRepository(Video);
  private static userRepository = AppDataSource.getRepository(User);
  private static readonly logger = Logger.getInstance();
  
  private static stripe: Stripe;

  private static readonly PURCHASE_LOCK_TTL = 300; // 5 minutes
  private static readonly PAYMENT_CACHE_TTL = 3600; // 1 hour

  private static initStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new PaymentError('Stripe secret key is not configured');
    }

    if (!this.stripe) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16'
      });
    }

    return this.stripe;
  }


// In payment.service.ts

static async createPaymentIntent(
  userId: string, 
  videoId: string
): Promise<PaymentIntentResponse> {
  const logger = this.logger.child({ 
    userId,
    videoId,
    operation: 'createPaymentIntent'
  });
  
  try {
    // Initialize Stripe
    const stripe = this.initStripe();

    // Verify video exists and get price
    const video = await this.videoRepository.findOne({
      where: { id: videoId }
    });

    if (!video) {
      throw new PaymentError('Video not found');
    }

    // Check for existing pending purchase
    const existingPurchase = await this.purchaseRepository.findOne({
      where: {
        userId,
        videoId,
        status: 'pending'
      }
    });

    if (existingPurchase) {
      logger.info('Found existing pending purchase', { purchaseId: existingPurchase.id });
      // If there's an existing payment intent, retrieve it
      if (existingPurchase.stripePaymentId) {
        try {
          const existingIntent = await stripe.paymentIntents.retrieve(existingPurchase.stripePaymentId);
          if (existingIntent.status !== 'canceled' && existingIntent.status !== 'succeeded') {
            return {
              clientSecret: existingIntent.client_secret!,
              paymentIntentId: existingIntent.id,
              amount: video.price,
              currency: 'usd',
              purchaseId: existingPurchase.id
            };
          }
        } catch (error) {
          logger.warn('Error retrieving existing payment intent', { error });
        }
      }
    }

    // Create or update purchase record
    const purchase = existingPurchase || this.purchaseRepository.create({
      userId,
      videoId,
      amount: video.price,
      status: 'pending'
    });

    const savedPurchase = await this.purchaseRepository.save(purchase);
    logger.info('Created/Updated purchase record:', { purchaseId: savedPurchase.id });

    // Create Stripe PaymentIntent
    const amountInCents = Math.round(video.price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        videoId,
        userId,
        purchaseId: savedPurchase.id
      }
    });

    // Update purchase with payment intent ID
    savedPurchase.stripePaymentId = paymentIntent.id;
    await this.purchaseRepository.save(savedPurchase);

    logger.info('Payment intent created:', {
      paymentIntentId: paymentIntent.id,
      purchaseId: savedPurchase.id
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: video.price,
      currency: 'usd',
      purchaseId: savedPurchase.id
    };
  } catch (error) {
    logger.error('Payment intent creation failed:', error);
    throw error;
  }
}

static async verifyPurchase(
  userId: string,
  videoId: string,
  paymentIntentId: string
): Promise<{ verified: boolean; purchase?: { id: string; status: string; completedAt?: string } }> {
  const logger = this.logger.child({
    userId,
    videoId,
    paymentIntentId,
    operation: 'verifyPurchase'
  });

  try {
    logger.info('Starting purchase verification');

    // First try to find any purchase matching these parameters
    const purchase = await this.purchaseRepository.findOne({
      where: [
        {
          userId,
          videoId,
          stripePaymentId: paymentIntentId,
        }
      ]
    });

    if (!purchase) {
      logger.error('Purchase not found during verification', {
        paymentIntentId,
        userId,
        videoId
      });
      return { verified: false };
    }

    logger.info('Purchase lookup result:', {
      found: !!purchase,
      status: purchase.status,
      completedAt: purchase.completedAt
    });

    // If the purchase exists but isn't completed, check Stripe
    if (purchase.status !== 'completed') {
      const stripe = this.initStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Update purchase status
        purchase.status = 'completed';
        purchase.completedAt = new Date();
        await this.purchaseRepository.save(purchase);
        
        logger.info('Updated purchase status to completed', {
          purchaseId: purchase.id,
          completedAt: purchase.completedAt
        });
      }
    }

    return {
      verified: purchase.status === 'completed',
      purchase: {
        id: purchase.id,
        status: purchase.status,
        completedAt: purchase.completedAt?.toISOString()
      }
    };
  } catch (error) {
    logger.error('Purchase verification failed:', error);
    throw error;
  }
}

  
  // Helper methods
  
// In payment.service.ts
// In payment.service.ts
static async verifyPayment(userId: string, paymentIntentId: string): Promise<{
  verified: boolean;
  purchase?: {
    id: string;
    status: 'pending' | 'completed' | 'failed';
    completedAt?: string;
  };
}> {
  try {
    const purchase = await this.purchaseRepository.findOne({
      where: {
        userId,
        stripePaymentId: paymentIntentId
      },
      select: ['id', 'status', 'completedAt']
    });

    return {
      verified: purchase?.status === 'completed',
      purchase: purchase ? {
        id: purchase.id,
        status: purchase.status,
        completedAt: purchase.completedAt?.toISOString() // Convert Date to ISO string
      } : undefined
    };
  } catch (error) {
    this.logger.error('Purchase verification error:', error);
    throw new PaymentError('Failed to verify payment');
  }
}

  

  private static readonly FULFILLMENT_LOCK_TTL = 300; // 5 minutes
private static readonly FULFILLMENT_CACHE_PREFIX = 'fulfillment:';

private static async acquireFulfillmentLock(
  paymentIntentId: string
): Promise<string | null> {
  const lockKey = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}:lock`;
  const token = Math.random().toString(36).substring(7);
  
  const result = await redisClient.set(
    lockKey,
    token,
    'EX',
    this.FULFILLMENT_LOCK_TTL,
    'NX'
  );
  
  return result === 'OK' ? token : null;
}

private static async releaseFulfillmentLock(
  paymentIntentId: string,
  token: string
): Promise<void> {
  const lockKey = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}:lock`;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  await redisClient.eval(script, 1, lockKey, token);
}

private static async markFulfillmentComplete(
  paymentIntentId: string,
  purchaseId: string
): Promise<void> {
  const key = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}`;
  await redisClient.setex(key, 86400, purchaseId); // Store for 24 hours
}

private static async isFulfillmentComplete(
  paymentIntentId: string
): Promise<boolean> {
  const key = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}`;
  const result = await redisClient.get(key);
  return !!result;
}

protected static async fulfillPayment(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  if (!paymentIntent.metadata?.purchaseId) {
    throw new PaymentError('Missing purchaseId in payment metadata');
  }

  // Try to acquire fulfillment lock
  const lockToken = await this.acquireFulfillmentLock(paymentIntent.id);
  if (!lockToken) {
    console.log('Fulfillment already in progress:', paymentIntent.id);
    return;
  }

  try {
    // Check if already fulfilled
    if (await this.isFulfillmentComplete(paymentIntent.id)) {
      console.log('Payment already fulfilled:', paymentIntent.id);
      return;
    }

    // Perform fulfillment in a transaction
    await AppDataSource.transaction(async transactionalEntityManager => {
      const purchase = await transactionalEntityManager
        .createQueryBuilder(Purchase, 'purchase')
        .where('purchase.id = :purchaseId', { 
          purchaseId: paymentIntent.metadata.purchaseId 
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!purchase) {
        throw new PaymentError('Purchase record not found');
      }

      if (purchase.status === 'completed') {
        console.log('Purchase already completed:', purchase.id);
        return;
      }

      // Update purchase status
      purchase.status = 'completed';
      purchase.stripePaymentId = paymentIntent.id;
      purchase.completedAt = new Date();

      await transactionalEntityManager.save(purchase);
      
      // Mark fulfillment as complete in cache
      await this.markFulfillmentComplete(paymentIntent.id, purchase.id);
      
      console.log('Payment fulfilled successfully:', {
        paymentIntentId: paymentIntent.id,
        purchaseId: purchase.id
      });
    });
  } finally {
    // Always release the lock
    await this.releaseFulfillmentLock(paymentIntent.id, lockToken);
  }
}
  /**
   * Handles Stripe webhook events
   */

  private static readonly ALLOWED_WEBHOOK_EVENTS = [
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.processing',
    'charge.succeeded',
    'charge.updated',
    'payment_intent.created'
  ] as const;

  private static isValidWebhookEvent(
    eventType: string
  ): eventType is typeof PaymentService.ALLOWED_WEBHOOK_EVENTS[number] {
    return this.ALLOWED_WEBHOOK_EVENTS.includes(eventType as any);
  }


// In payment.service.ts, update the handleWebhook method:
static async handleWebhook(event: Stripe.Event): Promise<void> {
  const logger = this.logger.child({
    eventId: event.id,
    eventType: event.type
  });

  logger.info('Processing webhook event');

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      logger.info('Processing payment_intent.succeeded', {
        paymentIntentId: paymentIntent.id,
        metadata: paymentIntent.metadata
      });

      // Find the pending purchase
      const purchase = await this.purchaseRepository.findOne({
        where: {
          stripePaymentId: paymentIntent.id,
          status: 'pending'
        }
      });

      if (!purchase) {
        logger.error('No pending purchase found for payment intent', {
          paymentIntentId: paymentIntent.id
        });
        return;
      }

      logger.info('Found pending purchase', {
        purchaseId: purchase.id,
        currentStatus: purchase.status
      });

      // Update the purchase
      purchase.status = 'completed';
      purchase.completedAt = new Date();
      purchase.updatedAt = new Date();

      await this.purchaseRepository.save(purchase);

      // Verify the update
      const verifiedPurchase = await this.purchaseRepository.findOne({
        where: { id: purchase.id }
      });

      logger.info('Purchase updated', {
        purchaseId: verifiedPurchase?.id,
        newStatus: verifiedPurchase?.status,
        completedAt: verifiedPurchase?.completedAt
      });
    }
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}
  
  // Helper methods that need to be added
  static async completePurchase(paymentIntentId: string): Promise<void> {
    const logger = this.logger.child({
      paymentIntentId,
      operation: 'completePurchase'
    });
  
    try {
      const purchase = await this.purchaseRepository.findOne({
        where: {
          stripePaymentId: paymentIntentId,
          status: 'pending'
        }
      });
  
      if (!purchase) {
        logger.error('Purchase not found');
        throw new PaymentError('Purchase not found');
      }
  
      logger.info('Completing purchase', {
        purchaseId: purchase.id,
        currentStatus: purchase.status
      });
  
      purchase.status = 'completed';
      purchase.completedAt = new Date();
      purchase.updatedAt = new Date();
  
      await this.purchaseRepository.save(purchase);
  
      logger.info('Purchase completed successfully', {
        purchaseId: purchase.id,
        newStatus: purchase.status,
        completedAt: purchase.completedAt
      });
    } catch (error) {
      logger.error('Purchase completion failed', error);
      throw error;
    }
  }
  private static validatePaymentMetadata(metadata: Stripe.Metadata | null): metadata is Required<{
    purchaseId: string;
    videoId: string;
    userId: string;
  }> {
    return !!(
      metadata?.purchaseId &&
      metadata?.videoId &&
      metadata?.userId
    );
  }
  
  private static fromCents(amount: number): number {
    return amount / 100;
  }
  

  /**
   * Retrieves purchase history for a user
   */
  static async getUserPurchases(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: PurchaseStatus['status'];
    } = {}
  ): Promise<{ purchases: Purchase[]; total: number; pages: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const [purchases, total] = await this.purchaseRepository.findAndCount({
        where: { 
          userId,
          ...(options.status && { status: options.status })
        },
        relations: ['video'],
        order: { createdAt: 'DESC' },
        skip,
        take: limit
      });

      return {
        purchases,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Failed to fetch user purchases:', error);
      throw new PaymentError('Failed to retrieve purchase history');
    }
  }

  /**
   * Retrieves sales history for a seller
   */
  static async getSellerSales(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: PurchaseStatus['status'];
    } = {}
  ): Promise<{ sales: Purchase[]; total: number; pages: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const queryBuilder = this.purchaseRepository
        .createQueryBuilder('purchase')
        .innerJoinAndSelect('purchase.video', 'video')
        .innerJoinAndSelect('purchase.user', 'buyer')
        .where('video.userId = :userId', { userId })
        .andWhere('purchase.status = :status', { status: 'completed' })
        .orderBy('purchase.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      if (options.status) {
        queryBuilder.andWhere('purchase.status = :purchaseStatus', {
          purchaseStatus: options.status
        });
      }

      const [sales, total] = await queryBuilder.getManyAndCount();

      return {
        sales,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Failed to fetch seller sales:', error);
      throw new PaymentError('Failed to retrieve sales history');
    }
  }

  /**
   * Cancels a pending purchase
   */
  static async cancelPurchase(purchaseId: string, userId: string): Promise<void> {
    try {
      const purchase = await this.purchaseRepository.findOne({
        where: { id: purchaseId, userId }
      });

      if (!purchase) {
        throw new PaymentError('Purchase not found');
      }

      if (purchase.status !== 'pending') {
        throw new PaymentError('Can only cancel pending purchases');
      }

      if (purchase.stripePaymentId) {
        await this.stripe.paymentIntents.cancel(purchase.stripePaymentId);
      }

      purchase.status = 'failed';
      await this.purchaseRepository.save(purchase);

    } catch (error) {
      this.logger.error('Purchase cancellation failed:', error);
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError('Failed to cancel purchase');
    }
  }

  /**
   * Private helper methods
   */
// In payment.service.ts, update the handleSuccessfulPayment method

protected static async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const logger = this.logger.child({ 
    paymentIntentId: paymentIntent.id,
    operation: 'handleSuccessfulPayment'
  });

  if (!paymentIntent.metadata?.purchaseId) {
    throw new PaymentError('Missing purchaseId in payment metadata');
  }

  const lockToken = await this.acquireFulfillmentLock(paymentIntent.id);
  if (!lockToken) {
    logger.info('Fulfillment already in progress');
    return;
  }

  try {
    await AppDataSource.transaction(async transactionalEntityManager => {
      const purchase = await transactionalEntityManager
      .createQueryBuilder(Purchase, 'purchase')
      .where('purchase.id = :purchaseId', { 
        purchaseId: paymentIntent.metadata.purchaseId 
      })
      .setLock('pessimistic_write')
      .getOne();
  
    if (!purchase) {
      throw new PaymentError(`Purchase not found: ${paymentIntent.metadata.purchaseId}`);
    }
  
    if (purchase.status === 'completed') {
      logger.info('Purchase already completed', { purchaseId: purchase.id });
      return;
    }
  
    // Set completedAt as a proper timestamp
    const completedAt = new Date();
    completedAt.setMilliseconds(0); // Ensure consistent formatting
    
    purchase.status = 'completed';
    purchase.stripePaymentId = paymentIntent.id;
    purchase.completedAt = completedAt;
    purchase.amount = this.fromCents(paymentIntent.amount);
  
    await transactionalEntityManager.save(purchase);
      await this.markFulfillmentComplete(paymentIntent.id, purchase.id);
      
      logger.info('Purchase successfully completed', {
        purchaseId: purchase.id,
        amount: purchase.amount,
        completedAt: completedAt.toISOString(),
        status: purchase.status
      });
    });
  } finally {
    await this.releaseFulfillmentLock(paymentIntent.id, lockToken);
  }
}

// Update verifyPurchase method to check complete

   static async handleFailedPayment(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { purchaseId } = paymentIntent.metadata;
    
    if (!purchaseId) {
      throw new PaymentError('Purchase ID not found in payment metadata');
    }

    const purchase = await this.purchaseRepository.findOne({
      where: { id: purchaseId }
    });

    if (!purchase) {
      throw new PaymentError('Purchase record not found');
    }

    purchase.status = 'failed';
    purchase.stripePaymentId = paymentIntent.id;
    
    await this.purchaseRepository.save(purchase);
    await this.clearPaymentCache(paymentIntent.id);
  }

   static async handleCanceledPayment(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { purchaseId } = paymentIntent.metadata;
    
    if (purchaseId) {
      const purchase = await this.purchaseRepository.findOne({
        where: { id: purchaseId }
      });

      if (purchase) {
        purchase.status = 'failed';
        purchase.stripePaymentId = paymentIntent.id;
        await this.purchaseRepository.save(purchase);
      }
    }

    await this.clearPaymentCache(paymentIntent.id);
  }

  private static async acquirePurchaseLock(
    userId: string,
    videoId: string
  ): Promise<string | null> {
    const lockKey = `purchase_lock:${userId}:${videoId}`;
    const token = Math.random().toString(36).substring(7);
    
    try {
      // Using SET with NX and EX options as a single command
      const result = await redisClient.set(
        lockKey,
        token,
        'EX',
        this.PURCHASE_LOCK_TTL,
        'NX'
      );
      
      return result === 'OK' ? token : null;
    } catch (error) {
      this.logger.error('Failed to acquire purchase lock:', error);
      return null;
    }
  }
  
  private static async releasePurchaseLock(
    userId: string,
    videoId: string,
    token: string
  ): Promise<void> {
    const lockKey = `purchase_lock:${userId}:${videoId}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
  
    try {
      await redisClient.eval(script, 1, lockKey, token);
    } catch (error) {
      this.logger.error('Failed to release purchase lock:', error);
    }
  }
  

  private static async cachePaymentIntent(
    paymentIntentId: string,
    purchaseId: string,
    videoId: string,
    userId: string
  ): Promise<void> {
    const cacheKey = `payment_intent:${paymentIntentId}`;
    await redisClient.setex(
      cacheKey,
      this.PAYMENT_CACHE_TTL,
      JSON.stringify({ purchaseId, videoId, userId })
    );
  }

  private static async clearPaymentCache(paymentIntentId: string): Promise<void> {
    const cacheKey = `payment_intent:${paymentIntentId}`;
    await redisClient.del(cacheKey);
  }

  // Add this to payment.service.ts

static async verifyWebhookConfiguration(): Promise<void> {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
    
    const webhooks = await stripe.webhookEndpoints.list();
    console.log('Configured webhooks:', webhooks.data.map(hook => ({
      url: hook.url,
      enabled_events: hook.enabled_events
    })));
  } catch (error) {
    console.error('Error checking webhook configuration:', error);
  }
}

}
