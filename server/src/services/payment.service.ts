// src/services/payment.service.ts
import Stripe from 'stripe';
import { AppDataSource } from "../config/database";
import { Purchase } from "../models/purchase.model";
import { Video } from "../models/video.model";
import { User } from "../models/user.model";
import { PaymentError } from "../types/errors";
import { PaymentIntent, PurchaseStatus } from "../types";
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
    console.log('Starting payment intent creation:', { userId, videoId });
    
    try {
      // Initialize Stripe
      const stripe = this.initStripe();

      // Verify video exists and get price
      console.log('Finding video:', videoId);
      const video = await this.videoRepository.findOne({
        where: { id: videoId },
        select: ['id', 'price', 'title'] // Add specific fields you need
      });

      console.log('Video lookup result:', video);

      if (!video) {
        console.error('Video not found:', videoId);
        throw new PaymentError('Video not found');
      }

      if (typeof video.price !== 'number' || video.price <= 0) {
        console.error('Invalid video price:', video.price);
        throw new PaymentError('Invalid video price');
      }

      // Check if video is already purchased
      console.log('Checking existing purchase');
      const existingPurchase = await this.purchaseRepository.findOne({
        where: { 
          userId, 
          videoId,
          status: 'completed'
        }
      });

      if (existingPurchase) {
        console.error('Video already purchased:', { userId, videoId });
        throw new PaymentError('Video already purchased');
      }

      // Acquire lock to prevent duplicate purchases
      console.log('Acquiring purchase lock');
      const lockToken = await this.acquirePurchaseLock(userId, videoId);
      if (!lockToken) {
        console.error('Failed to acquire purchase lock:', { userId, videoId });
        throw new PaymentError('Purchase already in progress');
      }

      try {
        // Create a new purchase record
        console.log('Creating purchase record');
        const purchase = this.purchaseRepository.create({
          userId,
          videoId,
          amount: video.price,
          status: 'pending'
        });

        console.log('Saving purchase record');
        const savedPurchase = await this.purchaseRepository.save(purchase);
        console.log('Purchase record created:', savedPurchase);

        // Convert price to cents for Stripe
        const amountInCents = Math.round(video.price * 100);
        console.log('Creating Stripe payment intent:', { 
          amount: amountInCents, 
          currency: 'usd',
          videoId,
          purchaseId: savedPurchase.id 
        });

        // Create Stripe PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: toCents(video.price),
          currency: 'usd',
          metadata: {
            purchaseId: savedPurchase.id,
            videoId,
            userId
          },
          automatic_payment_methods: {
            enabled: true
          }
        });

        console.log('Payment intent created:', { 
          intentId: paymentIntent.id, 
          status: paymentIntent.status,
          hasClientSecret: !!paymentIntent.client_secret
        });

        if (!paymentIntent.client_secret) {
          throw new PaymentError('Failed to generate client secret');
        }

        // Cache payment intent details
        await this.cachePaymentIntent(
          paymentIntent.id,
          savedPurchase.id,
          videoId,
          userId
        );

        return {
          clientSecret: paymentIntent.client_secret!,
          amount: video.price, // Return in dollars
          currency: 'usd'
        };
      } finally {
        // Release lock regardless of outcome
        await this.releasePurchaseLock(userId, videoId, lockToken);
      }
    } catch (error) {
      console.error('Payment intent creation failed:', {
        error,
        userId,
        videoId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
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
  /**
   * Handles Stripe webhook events
   */

static async handleWebhook(event: Stripe.Event): Promise<void> {
  try {
    console.log('Processing webhook event:', {
      type: event.type,
      id: event.id,
      objectId: 'id' in event.data.object ? event.data.object.id : 'unknown'
    });

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Processing payment_intent.succeeded:', {
          id: paymentIntent.id,
          metadata: paymentIntent.metadata,
          amount: paymentIntent.amount
        });

        // Check if payment intent has required metadata
        if (!paymentIntent.metadata?.purchaseId) {
          console.error('No purchaseId in payment intent metadata:', paymentIntent.id);
          return;
        }

        await AppDataSource.transaction(async transactionalEntityManager => {
          const purchase = await transactionalEntityManager
            .createQueryBuilder(Purchase, 'purchase')
            .where('purchase.id = :purchaseId', { 
              purchaseId: paymentIntent.metadata.purchaseId 
            })
            .setLock('pessimistic_write')
            .getOne();

          if (!purchase) {
            console.error('Purchase not found:', paymentIntent.metadata.purchaseId);
            return;
          }

          console.log('Updating purchase status:', {
            id: purchase.id,
            oldStatus: purchase.status,
            newStatus: 'completed'
          });

          purchase.status = 'completed';
          purchase.stripePaymentId = paymentIntent.id;
          purchase.completedAt = new Date();

          await transactionalEntityManager.save(purchase);
          
          console.log('Purchase status updated successfully:', {
            id: purchase.id,
            status: 'completed'
          });
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Processing payment_intent.payment_failed:', {
          id: paymentIntent.id,
          metadata: paymentIntent.metadata
        });

        if (paymentIntent.metadata?.purchaseId) {
          const purchase = await this.purchaseRepository.findOne({
            where: { id: paymentIntent.metadata.purchaseId }
          });

          if (purchase) {
            purchase.status = 'failed';
            purchase.stripePaymentId = paymentIntent.id;
            await this.purchaseRepository.save(purchase);
          }
        }
        break;
      }

      // Handle these events but don't error
      case 'charge.succeeded':
      case 'charge.updated':
      case 'payment_intent.created':
        console.log(`Processing ${event.type}:`, {
          id: event.data.object.id
        });
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
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