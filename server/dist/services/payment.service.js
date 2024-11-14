"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
// src/services/payment.service.ts
const stripe_1 = __importDefault(require("stripe"));
const database_1 = require("../config/database");
const purchase_model_1 = require("../models/purchase.model");
const video_model_1 = require("../models/video.model");
const user_model_1 = require("../models/user.model");
const errors_1 = require("../types/errors");
const logger_1 = require("../utils/logger");
const redis_1 = __importDefault(require("../config/redis"));
class PaymentService {
    static initStripe() {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new errors_1.PaymentError('Stripe secret key is not configured');
        }
        if (!this.stripe) {
            this.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16'
            });
        }
        return this.stripe;
    }
    // In payment.service.ts
    static async createPaymentIntent(userId, videoId) {
        const logger = this.logger.child({
            userId,
            videoId,
            operation: 'createPaymentIntent'
        });
        try {
            // Check if the video has already been purchased by the user
            const alreadyPurchased = await this.hasUserPurchasedVideo(userId, videoId);
            if (alreadyPurchased) {
                throw new errors_1.PaymentError('Video already purchased');
            }
            // Initialize Stripe
            const stripe = this.initStripe();
            // Verify video exists and get price
            const video = await this.videoRepository.findOne({
                where: { id: videoId },
                relations: ['user']
            });
            if (!video) {
                throw new errors_1.PaymentError('Video not found');
            }
            const seller = await this.userRepository.findOne({
                where: { id: video.userId }
            });
            if (!seller?.stripeConnectAccountId) {
                throw new errors_1.PaymentError('Seller not configured for payments');
            }
            const amountInCents = Math.round(video.price * 100);
            const platformFee = Math.round(amountInCents * 0.10); // 10% platform fee
            const purchase = new purchase_model_1.Purchase();
            purchase.userId = userId;
            purchase.videoId = videoId;
            purchase.status = 'pending';
            purchase.amount = video.price;
            const savedPurchase = await this.purchaseRepository.save(purchase);
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amountInCents,
                currency: 'usd',
                payment_method_types: ['card'],
                application_fee_amount: platformFee,
                transfer_data: {
                    destination: seller.stripeConnectAccountId,
                },
                metadata: {
                    videoId,
                    userId,
                    sellerId: seller.id,
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
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: video.price,
                currency: 'usd',
                purchaseId: savedPurchase.id
            };
        }
        catch (error) {
            logger.error('Payment intent creation failed:', error);
            throw error;
        }
    }
    static async verifyPurchase(userId, videoId, paymentIntentId) {
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
        }
        catch (error) {
            logger.error('Purchase verification failed:', error);
            throw error;
        }
    }
    // Helper methods
    // In payment.service.ts
    // In payment.service.ts
    static async verifyPayment(userId, paymentIntentId) {
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
        }
        catch (error) {
            this.logger.error('Purchase verification error:', error);
            throw new errors_1.PaymentError('Failed to verify payment');
        }
    }
    static async acquireFulfillmentLock(paymentIntentId) {
        const lockKey = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}:lock`;
        const token = Math.random().toString(36).substring(7);
        const result = await redis_1.default.set(lockKey, token, 'EX', this.FULFILLMENT_LOCK_TTL, 'NX');
        return result === 'OK' ? token : null;
    }
    static async releaseFulfillmentLock(paymentIntentId, token) {
        const lockKey = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}:lock`;
        const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
        await redis_1.default.eval(script, 1, lockKey, token);
    }
    static async markFulfillmentComplete(paymentIntentId, purchaseId) {
        const key = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}`;
        await redis_1.default.setex(key, 86400, purchaseId); // Store for 24 hours
    }
    static async isFulfillmentComplete(paymentIntentId) {
        const key = `${this.FULFILLMENT_CACHE_PREFIX}${paymentIntentId}`;
        const result = await redis_1.default.get(key);
        return !!result;
    }
    static async fulfillPayment(paymentIntent) {
        if (!paymentIntent.metadata?.purchaseId) {
            throw new errors_1.PaymentError('Missing purchaseId in payment metadata');
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
            await database_1.AppDataSource.transaction(async (transactionalEntityManager) => {
                const purchase = await transactionalEntityManager
                    .createQueryBuilder(purchase_model_1.Purchase, 'purchase')
                    .where('purchase.id = :purchaseId', {
                    purchaseId: paymentIntent.metadata.purchaseId
                })
                    .setLock('pessimistic_write')
                    .getOne();
                if (!purchase) {
                    throw new errors_1.PaymentError('Purchase record not found');
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
        }
        finally {
            // Always release the lock
            await this.releaseFulfillmentLock(paymentIntent.id, lockToken);
        }
    }
    static isValidWebhookEvent(eventType) {
        return this.ALLOWED_WEBHOOK_EVENTS.includes(eventType);
    }
    // In payment.service.ts, update the handleWebhook method:
    static async handleWebhook(event) {
        const logger = this.logger.child({
            eventId: event.id,
            eventType: event.type
        });
        logger.info('Processing webhook event');
        try {
            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
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
        }
        catch (error) {
            logger.error('Webhook processing error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
    // Helper methods that need to be added
    static async completePurchase(paymentIntentId) {
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
                throw new errors_1.PaymentError('Purchase not found');
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
        }
        catch (error) {
            logger.error('Purchase completion failed', error);
            throw error;
        }
    }
    static validatePaymentMetadata(metadata) {
        return !!(metadata?.purchaseId &&
            metadata?.videoId &&
            metadata?.userId);
    }
    static fromCents(amount) {
        return amount / 100;
    }
    /**
     * Retrieves purchase history for a user
     */
    static async getUserPurchases(userId, options = {}) {
        try {
            const page = options.page || 1;
            const limit = options.limit || 10;
            const skip = (page - 1) * limit;
            const [purchases, total] = await database_1.AppDataSource.getRepository(purchase_model_1.Purchase).findAndCount({
                where: { userId, ...(options.status && { status: options.status }) },
                relations: ['video'],
                order: { createdAt: 'DESC' },
                skip,
                take: limit,
            });
            return {
                purchases,
                total,
                pages: Math.ceil(total / limit),
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch user purchases:', error);
            throw new Error('Failed to retrieve purchase history');
        }
    }
    /**
     * Retrieves sales history for a seller
     */
    static async getSellerSales(userId, options = {}) {
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
        }
        catch (error) {
            this.logger.error('Failed to fetch seller sales:', error);
            throw new errors_1.PaymentError('Failed to retrieve sales history');
        }
    }
    /**
     * Cancels a pending purchase
     */
    static async cancelPurchase(purchaseId, userId) {
        try {
            const purchase = await this.purchaseRepository.findOne({
                where: { id: purchaseId, userId }
            });
            if (!purchase) {
                throw new errors_1.PaymentError('Purchase not found');
            }
            if (purchase.status !== 'pending') {
                throw new errors_1.PaymentError('Can only cancel pending purchases');
            }
            if (purchase.stripePaymentId) {
                await this.stripe.paymentIntents.cancel(purchase.stripePaymentId);
            }
            purchase.status = 'failed';
            await this.purchaseRepository.save(purchase);
        }
        catch (error) {
            this.logger.error('Purchase cancellation failed:', error);
            if (error instanceof errors_1.PaymentError) {
                throw error;
            }
            throw new errors_1.PaymentError('Failed to cancel purchase');
        }
    }
    /**
     * Private helper methods
     */
    // In payment.service.ts, update the handleSuccessfulPayment method
    static async handleSuccessfulPayment(paymentIntent) {
        const logger = this.logger.child({
            paymentIntentId: paymentIntent.id,
            operation: 'handleSuccessfulPayment'
        });
        if (!paymentIntent.metadata?.purchaseId) {
            throw new errors_1.PaymentError('Missing purchaseId in payment metadata');
        }
        const lockToken = await this.acquireFulfillmentLock(paymentIntent.id);
        if (!lockToken) {
            logger.info('Fulfillment already in progress');
            return;
        }
        try {
            await database_1.AppDataSource.transaction(async (transactionalEntityManager) => {
                const purchase = await transactionalEntityManager
                    .createQueryBuilder(purchase_model_1.Purchase, 'purchase')
                    .where('purchase.id = :purchaseId', {
                    purchaseId: paymentIntent.metadata.purchaseId
                })
                    .setLock('pessimistic_write')
                    .getOne();
                if (!purchase) {
                    throw new errors_1.PaymentError(`Purchase not found: ${paymentIntent.metadata.purchaseId}`);
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
        }
        finally {
            await this.releaseFulfillmentLock(paymentIntent.id, lockToken);
        }
    }
    // Update verifyPurchase method to check complete
    static async handleFailedPayment(paymentIntent) {
        const { purchaseId } = paymentIntent.metadata;
        if (!purchaseId) {
            throw new errors_1.PaymentError('Purchase ID not found in payment metadata');
        }
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId }
        });
        if (!purchase) {
            throw new errors_1.PaymentError('Purchase record not found');
        }
        purchase.status = 'failed';
        purchase.stripePaymentId = paymentIntent.id;
        await this.purchaseRepository.save(purchase);
        await this.clearPaymentCache(paymentIntent.id);
    }
    static async handleCanceledPayment(paymentIntent) {
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
    static async acquirePurchaseLock(userId, videoId) {
        const lockKey = `purchase_lock:${userId}:${videoId}`;
        const token = Math.random().toString(36).substring(7);
        try {
            // Using SET with NX and EX options as a single command
            const result = await redis_1.default.set(lockKey, token, 'EX', this.PURCHASE_LOCK_TTL, 'NX');
            return result === 'OK' ? token : null;
        }
        catch (error) {
            this.logger.error('Failed to acquire purchase lock:', error);
            return null;
        }
    }
    static async releasePurchaseLock(userId, videoId, token) {
        const lockKey = `purchase_lock:${userId}:${videoId}`;
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
        try {
            await redis_1.default.eval(script, 1, lockKey, token);
        }
        catch (error) {
            this.logger.error('Failed to release purchase lock:', error);
        }
    }
    static async cachePaymentIntent(paymentIntentId, purchaseId, videoId, userId) {
        const cacheKey = `payment_intent:${paymentIntentId}`;
        await redis_1.default.setex(cacheKey, this.PAYMENT_CACHE_TTL, JSON.stringify({ purchaseId, videoId, userId }));
    }
    static async clearPaymentCache(paymentIntentId) {
        const cacheKey = `payment_intent:${paymentIntentId}`;
        await redis_1.default.del(cacheKey);
    }
    // Add this to payment.service.ts
    static async verifyWebhookConfiguration() {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            console.error('STRIPE_WEBHOOK_SECRET is not configured');
        }
        try {
            const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16'
            });
            const webhooks = await stripe.webhookEndpoints.list();
            console.log('Configured webhooks:', webhooks.data.map(hook => ({
                url: hook.url,
                enabled_events: hook.enabled_events
            })));
        }
        catch (error) {
            console.error('Error checking webhook configuration:', error);
        }
    }
    // Implement the logic to check if the user has already purchased the video
    // This could involve querying your database to see if a purchase record exists
    static async hasUserPurchasedVideo(userId, videoId) {
        const purchase = await this.purchaseRepository.findOne({ where: { userId, videoId, status: 'completed' } });
        return !!purchase;
    }
}
exports.PaymentService = PaymentService;
PaymentService.purchaseRepository = database_1.AppDataSource.getRepository(purchase_model_1.Purchase);
PaymentService.videoRepository = database_1.AppDataSource.getRepository(video_model_1.Video);
PaymentService.userRepository = database_1.AppDataSource.getRepository(user_model_1.User);
PaymentService.logger = logger_1.Logger.getInstance();
PaymentService.PURCHASE_LOCK_TTL = 300; // 5 minutes
PaymentService.PAYMENT_CACHE_TTL = 3600; // 1 hour
PaymentService.FULFILLMENT_LOCK_TTL = 300; // 5 minutes
PaymentService.FULFILLMENT_CACHE_PREFIX = 'fulfillment:';
/**
 * Handles Stripe webhook events
 */
PaymentService.ALLOWED_WEBHOOK_EVENTS = [
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.processing',
    'charge.succeeded',
    'charge.updated',
    'payment_intent.created'
];
