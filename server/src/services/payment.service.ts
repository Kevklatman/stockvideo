// src/services/payment.service.ts
import Stripe from 'stripe';
import { AppDataSource } from "../config/database";
import { Purchase } from "../models/purchase.model";
import { Video } from "../models/video.model";
import { User } from "../models/user.model";
import { PaymentError } from "../types/errors";
import { PaymentIntent, PurchaseStatus, ValidationError } from "../types";
import { Logger } from "../utils/logger";
import redisClient from '../config/redis';
import { toCents, isValidPrice, parsePrice } from '../utils/price';

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


  static async createPaymentIntent(
    userId: string, 
    videoId: string, 
  ): Promise<PaymentIntent> {
    const logger = this.logger.child({ 
      userId,
      videoId,
      operation: 'createPaymentIntent'
    });
  
    logger.info('Starting payment intent creation');
    
    try {
      // Validate inputs
      if (!userId || !videoId) {
        throw new ValidationError('User ID and Video ID are required');
      }
  
      // Initialize Stripe
      const stripe = this.initStripe();
  
      // Start transaction for data consistency
      return await AppDataSource.transaction(async transactionalEntityManager => {
        // Verify video exists and get price with pessimistic lock
        const video = await transactionalEntityManager
          .createQueryBuilder(Video, 'video')
          .where('video.id = :videoId', { videoId })
          .select(['video.id', 'video.price', 'video.title', 'video.userId'])
          .setLock('pessimistic_read')
          .getOne();
  
        if (!video) {
          logger.error('Video not found');
          throw new PaymentError('Video not found');
        }
  
        // Validate video price
        if (!this.isValidPrice(video.price)) {
          logger.error('Invalid video price', { price: video.price });
          throw new PaymentError('Invalid video price');
        }
  
        // Prevent purchasing own video
        if (video.userId === userId) {
          logger.error('Cannot purchase own video');
          throw new PaymentError('Cannot purchase your own video');
        }
  
        // Check for existing completed purchase
        const existingPurchase = await transactionalEntityManager
          .createQueryBuilder(Purchase, 'purchase')
          .where('purchase.userId = :userId', { userId })
          .andWhere('purchase.videoId = :videoId', { videoId })
          .andWhere('purchase.status = :status', { status: 'completed' })
          .getOne();
  
        if (existingPurchase) {
          logger.error('Video already purchased', { purchaseId: existingPurchase.id });
          throw new PaymentError('Video already purchased');
        }
  
        // Check for pending purchases that aren't expired
        const pendingPurchase = await transactionalEntityManager
          .createQueryBuilder(Purchase, 'purchase')
          .where('purchase.userId = :userId', { userId })
          .andWhere('purchase.videoId = :videoId', { videoId })
          .andWhere('purchase.status = :status', { status: 'pending' })
          .andWhere('purchase.createdAt > :cutoff', { 
            cutoff: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
          })
          .getOne();
  
        if (pendingPurchase) {
          logger.error('Purchase already in progress', { purchaseId: pendingPurchase.id });
          throw new PaymentError('Purchase already in progress');
        }
  
        // Acquire distributed lock
        const lockToken = await this.acquirePurchaseLock(userId, videoId);
        if (!lockToken) {
          logger.error('Failed to acquire purchase lock');
          throw new PaymentError('Purchase already in progress');
        }
  
        try {
          // Create purchase record
          const purchase = transactionalEntityManager.create(Purchase, {
            userId,
            videoId,
            amount: video.price,
            status: 'pending'
          });
  
          const savedPurchase = await transactionalEntityManager.save(purchase);
          logger.info('Purchase record created', { purchaseId: savedPurchase.id });
  
          // Create payment intent with Stripe
          const paymentIntent = await stripe.paymentIntents.create({
            amount: this.toCents(video.price),
            currency: 'usd',
            metadata: {
              purchaseId: savedPurchase.id,
              videoId,
              userId
            },
            automatic_payment_methods: {
              enabled: true
            },
            statement_descriptor_suffix: video.title.substring(0, 22),
            receipt_email: await this.getUserEmail(userId),
            description: `Video: ${video.title}`
          });
  
          if (!paymentIntent.client_secret) {
            throw new PaymentError('Failed to generate client secret');
          }
  
          // Update purchase record with Stripe payment ID
          savedPurchase.stripePaymentId = paymentIntent.id;
          await transactionalEntityManager.save(savedPurchase);
  
          // Cache payment intent details with TTL
          await this.cachePaymentIntent(
            paymentIntent.id,
            savedPurchase.id,
            videoId,
            userId
          );
  
          logger.info('Payment intent created successfully', { 
            paymentIntentId: paymentIntent.id,
            purchaseId: savedPurchase.id
          });
  
          return {
            clientSecret: paymentIntent.client_secret,
            amount: video.price,
            currency: 'usd',
            purchaseId: savedPurchase.id,
            paymentIntentId: paymentIntent.id
          };
        } finally {
          // Always release the lock
          await this.releasePurchaseLock(userId, videoId, lockToken);
        }
      });
    } catch (error) {
      logger.error('Payment intent creation failed', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : 'Unknown error'
      });
  
      if (error instanceof PaymentError) {
        throw error;
      }
  
      if (error instanceof Stripe.errors.StripeError) {
        throw new PaymentError(`Stripe error: ${error.message}`);
      }
  
      throw new PaymentError(
        'Failed to create payment intent: ' + 
        (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }
  
  // Helper methods
  private static isValidPrice(price: unknown): price is number {
    return (
      typeof price === 'number' &&
      !isNaN(price) &&
      price > 0 &&
      price <= 1000000 // $1M max price
    );
  }
  
  private static toCents(amount: number): number {
    return Math.round(amount * 100);
  }
  
  private static async getUserEmail(userId: string): Promise<string | undefined> {
    try {
      const user = await AppDataSource
        .getRepository(User)
        .findOne({
          where: { id: userId },
          select: ['email']
        });
      return user?.email;
    } catch (error) {
      console.error('Error fetching user email:', error);
      return undefined;
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

  /**
   * Verifies if a user has purchased a video
   */
  static async verifyPurchase(userId: string, videoId: string): Promise<{ 
    verified: boolean;
    purchase?: Purchase;
  }> {
    try {
      console.log('Verifying purchase:', { userId, videoId });
      
      const purchase = await this.purchaseRepository.findOne({
        where: {
          userId,
          videoId,
          status: 'completed'
        }
      });
  
      console.log('Purchase verification result:', {
        found: !!purchase,
        status: purchase?.status,
        completedAt: purchase?.completedAt,
        stripePaymentId: purchase?.stripePaymentId
      });
  
      return {
        verified: !!purchase,
        purchase: purchase || undefined
      };
    } catch (error) {
      console.error('Purchase verification error:', error);
      return { verified: false };
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

  private static validateWebhookEvent(event: Stripe.Event): void {
    // Validate event type
    if (!this.isValidWebhookEvent(event.type)) {
      throw new Error(`Unsupported webhook event type: ${event.type}`);
    }

    // Validate event data structure
    if (!event.data?.object) {
      throw new Error('Invalid event data structure');
    }

    // For payment_intent events, validate the payment intent object
    if (event.type.startsWith('payment_intent.') && 
        (event.data.object as Stripe.PaymentIntent).object !== 'payment_intent') {
      throw new Error('Invalid payment intent data');
    }
  }

// In payment.service.ts, update the handleWebhook method:
static async handleWebhook(event: Stripe.Event): Promise<void> {
  const eventLogger = this.logger.child({ 
    eventId: event.id,
    eventType: event.type
  });

  try {
    // Validate event before processing
    this.validateWebhookEvent(event);

    eventLogger.info('Processing webhook event', {
      type: event.type,
      id: event.id,
      objectId: 'id' in event.data.object ? event.data.object.id : 'unknown'
    });

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      if (!this.validatePaymentMetadata(paymentIntent.metadata)) {
        eventLogger.error('Invalid payment metadata', { metadata: paymentIntent.metadata });
        return;
      }

      const lockToken = await this.acquireFulfillmentLock(paymentIntent.id);
      if (!lockToken) {
        eventLogger.info('Fulfillment already in progress', { paymentIntentId: paymentIntent.id });
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
            eventLogger.info('Purchase already completed', { purchaseId: purchase.id });
            return;
          }

          purchase.status = 'completed';
          purchase.stripePaymentId = paymentIntent.id;
          purchase.completedAt = new Date();
          purchase.amount = this.fromCents(paymentIntent.amount);

          await transactionalEntityManager.save(purchase);
          await this.markFulfillmentComplete(paymentIntent.id, purchase.id);
          
          eventLogger.info('Purchase successfully completed', {
            purchaseId: purchase.id,
            amount: purchase.amount,
            status: purchase.status
          });
        });
      } finally {
        await this.releaseFulfillmentLock(paymentIntent.id, lockToken);
      }
    }
  } catch (error) {
    eventLogger.error('Error processing webhook', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error 
    });
    throw error;
  }
}
  
  // Helper methods that need to be added
  
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
  static async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Processing successful payment:', {
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
      amount: paymentIntent.amount,
      status: paymentIntent.status
    });
  
    const { purchaseId } = paymentIntent.metadata;
    
    if (!purchaseId) {
      console.error('Missing purchaseId in metadata:', paymentIntent);
      throw new PaymentError('Purchase ID not found in payment metadata');
    }
  
    try {
      await AppDataSource.transaction(async transactionalEntityManager => {
        const purchase = await transactionalEntityManager
          .createQueryBuilder(Purchase, 'purchase')
          .where('purchase.id = :purchaseId', { purchaseId })
          .setLock('pessimistic_write')
          .getOne();
  
        if (!purchase) {
          console.error('Purchase record not found:', purchaseId);
          throw new PaymentError('Purchase record not found');
        }
  
        console.log('Updating purchase record:', {
          id: purchaseId,
          currentStatus: purchase.status,
          newStatus: 'completed'
        });
  
        purchase.status = 'completed';
        purchase.stripePaymentId = paymentIntent.id;
        purchase.completedAt = new Date();
        
        await transactionalEntityManager.save(purchase);
        
        console.log('Purchase status updated successfully:', {
          purchaseId,
          newStatus: 'completed',
          stripePaymentId: paymentIntent.id
        });
      });
  
      await this.clearPaymentCache(paymentIntent.id);
    } catch (error) {
      console.error('Error updating purchase status:', error);
      throw error;
    }
  }

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

// Call this when your server starts
}