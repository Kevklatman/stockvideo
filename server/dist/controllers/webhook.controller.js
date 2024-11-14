"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const stripe_1 = __importDefault(require("stripe"));
const database_1 = require("../config/database");
const purchase_model_1 = require("../models/purchase.model");
const logger_1 = require("../utils/logger");
class WebhookController {
    static getLogger(context) {
        return this.logger.child(context);
    }
    static async handleStripeWebhook(req, res) {
        const logger = WebhookController.getLogger({
            service: 'WebhookController',
            handler: 'handleStripeWebhook'
        });
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
            logger.error('Missing required environment variables');
            return res.status(500).json({
                status: 'error',
                message: 'Server configuration error'
            });
        }
        const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16'
        });
        const sig = req.headers['stripe-signature'];
        try {
            logger.info('Received webhook', {
                signature: !!sig,
                contentType: req.headers['content-type']
            });
            if (!sig) {
                logger.error('Missing Stripe signature');
                return res.status(400).json({
                    status: 'error',
                    message: 'Missing signature'
                });
            }
            // Verify webhook signature
            const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
            logger.info('Webhook event received', {
                type: event.type,
                id: event.id
            });
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await WebhookController.handlePaymentIntentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await WebhookController.handlePaymentIntentFailed(event.data.object);
                    break;
                case 'payment_intent.processing':
                    await WebhookController.handlePaymentIntentProcessing(event.data.object);
                    break;
                default:
                    logger.info('Unhandled event type', { type: event.type });
            }
            res.json({ received: true });
        }
        catch (err) {
            logger.error('Webhook processing error', {
                error: err instanceof Error ? err.message : 'Unknown error',
                stack: err instanceof Error ? err.stack : undefined
            });
            // Still return 200 to acknowledge receipt
            return res.status(200).json({
                received: true,
                warning: 'Event received but processing failed'
            });
        }
    }
    // In webhook.controller.ts, update handlePaymentIntentSucceeded
    static async handlePaymentIntentSucceeded(paymentIntent) {
        const logger = WebhookController.getLogger({
            handler: 'handlePaymentIntentSucceeded',
            paymentIntentId: paymentIntent.id
        });
        try {
            await database_1.AppDataSource.transaction(async (transactionalEntityManager) => {
                const purchase = await transactionalEntityManager
                    .createQueryBuilder(purchase_model_1.Purchase, 'purchase')
                    .where('purchase.stripePaymentId = :paymentIntentId', {
                    paymentIntentId: paymentIntent.id
                })
                    .setLock('pessimistic_write')
                    .getOne();
                if (!purchase) {
                    logger.error('Purchase not found for payment intent', {
                        paymentIntentId: paymentIntent.id,
                        metadata: paymentIntent.metadata
                    });
                    return;
                }
                if (purchase.status === 'completed' && purchase.completedAt) {
                    logger.info('Purchase already completed', {
                        purchaseId: purchase.id,
                        completedAt: purchase.completedAt
                    });
                    return;
                }
                const completedAt = new Date();
                completedAt.setMilliseconds(0);
                purchase.status = 'completed';
                purchase.completedAt = completedAt;
                purchase.updatedAt = new Date();
                await transactionalEntityManager.save(purchase);
                logger.info('Purchase marked as completed', {
                    purchaseId: purchase.id,
                    paymentIntentId: paymentIntent.id,
                    completedAt: completedAt.toISOString()
                });
            });
        }
        catch (error) {
            logger.error('Failed to process successful payment', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                paymentIntentId: paymentIntent.id
            });
            throw error;
        }
    }
    static async handlePaymentIntentFailed(paymentIntent) {
        const logger = WebhookController.getLogger({
            handler: 'handlePaymentIntentFailed',
            paymentIntentId: paymentIntent.id
        });
        try {
            await database_1.AppDataSource.transaction(async (transactionalEntityManager) => {
                const purchase = await transactionalEntityManager
                    .createQueryBuilder(purchase_model_1.Purchase, 'purchase')
                    .where('purchase.stripePaymentId = :paymentIntentId', {
                    paymentIntentId: paymentIntent.id
                })
                    .setLock('pessimistic_write')
                    .getOne();
                if (!purchase) {
                    logger.warn('Purchase not found for failed payment', {
                        paymentIntentId: paymentIntent.id
                    });
                    return;
                }
                purchase.status = 'failed';
                purchase.updatedAt = new Date();
                await transactionalEntityManager.save(purchase);
                logger.info('Purchase marked as failed', { purchaseId: purchase.id });
            });
        }
        catch (error) {
            logger.error('Failed to process failed payment', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
    static async handlePaymentIntentProcessing(paymentIntent) {
        const logger = WebhookController.getLogger({
            handler: 'handlePaymentIntentProcessing',
            paymentIntentId: paymentIntent.id
        });
        try {
            await database_1.AppDataSource.transaction(async (transactionalEntityManager) => {
                const purchase = await transactionalEntityManager
                    .createQueryBuilder(purchase_model_1.Purchase, 'purchase')
                    .where('purchase.stripePaymentId = :paymentIntentId', {
                    paymentIntentId: paymentIntent.id
                })
                    .setLock('pessimistic_write')
                    .getOne();
                if (!purchase) {
                    logger.warn('Purchase not found for processing payment', {
                        paymentIntentId: paymentIntent.id
                    });
                    return;
                }
                // Ensure status is 'pending' while processing
                if (purchase.status !== 'pending') {
                    purchase.status = 'pending';
                    purchase.updatedAt = new Date();
                    await transactionalEntityManager.save(purchase);
                    logger.info('Purchase marked as pending', { purchaseId: purchase.id });
                }
            });
        }
        catch (error) {
            logger.error('Failed to process processing payment', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
}
exports.WebhookController = WebhookController;
WebhookController.logger = logger_1.Logger.getInstance();
