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
class PaymentService {
    /**
     * Creates a payment intent with Stripe and initializes a purchase record
     */
    static async createPaymentIntent(userId, videoId) {
        // Verify video exists and get price
        const video = await this.videoRepository.findOne({
            where: { id: videoId }
        });
        if (!video) {
            throw new Error('Video not found');
        }
        // Check if user already purchased
        const existingPurchase = await this.purchaseRepository.findOne({
            where: { userId, videoId }
        });
        if (existingPurchase) {
            throw new Error('Video already purchased');
        }
        // Create a new purchase record in 'pending' state
        const purchase = new purchase_model_1.Purchase();
        purchase.userId = userId;
        purchase.videoId = videoId;
        purchase.amount = video.price;
        purchase.status = 'pending';
        await this.purchaseRepository.save(purchase);
        // Create Stripe PaymentIntent
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(video.price * 100), // Convert to cents
            currency: 'usd',
            metadata: {
                purchaseId: purchase.id,
                videoId: videoId,
                userId: userId
            }
        });
        return {
            clientSecret: paymentIntent.client_secret,
            purchase
        };
    }
    /**
     * Verifies if a user has purchased a video
     */
    static async verifyPurchase(userId, videoId) {
        const purchase = await this.purchaseRepository.findOne({
            where: {
                userId,
                videoId,
                status: 'completed'
            }
        });
        return !!purchase;
    }
    /**
     * Handles Stripe webhook events
     */
    static async handleWebhook(event) {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                await this.handleSuccessfulPayment(paymentIntent);
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                await this.handleFailedPayment(paymentIntent);
                break;
            }
        }
    }
    /**
     * Updates purchase record after successful payment
     */
    static async handleSuccessfulPayment(paymentIntent) {
        const { purchaseId } = paymentIntent.metadata;
        if (!purchaseId) {
            throw new Error('Purchase ID not found in payment metadata');
        }
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId }
        });
        if (!purchase) {
            throw new Error('Purchase record not found');
        }
        purchase.status = 'completed';
        purchase.stripePaymentId = paymentIntent.id;
        purchase.completedAt = new Date();
        await this.purchaseRepository.save(purchase);
    }
    /**
     * Updates purchase record after failed payment
     */
    static async handleFailedPayment(paymentIntent) {
        const { purchaseId } = paymentIntent.metadata;
        if (!purchaseId) {
            throw new Error('Purchase ID not found in payment metadata');
        }
        const purchase = await this.purchaseRepository.findOne({
            where: { id: purchaseId }
        });
        if (!purchase) {
            throw new Error('Purchase record not found');
        }
        purchase.status = 'failed';
        purchase.stripePaymentId = paymentIntent.id;
        await this.purchaseRepository.save(purchase);
    }
    /**
     * Retrieves purchase history for a user
     */
    static async getUserPurchases(userId) {
        return this.purchaseRepository.find({
            where: {
                userId,
                status: 'completed'
            },
            relations: ['video'],
            order: { purchasedAt: 'DESC' }
        });
    }
    /**
     * Retrieves sales history for a seller
     */
    static async getSellerSales(userId) {
        return this.purchaseRepository
            .createQueryBuilder('purchase')
            .innerJoinAndSelect('purchase.video', 'video')
            .where('video.userId = :userId', { userId })
            .andWhere('purchase.status = :status', { status: 'completed' })
            .orderBy('purchase.purchasedAt', 'DESC')
            .getMany();
    }
    /**
     * Retrieves a specific purchase record
     */
    static async getPurchase(purchaseId) {
        return this.purchaseRepository.findOne({
            where: { id: purchaseId },
            relations: ['video', 'user']
        });
    }
}
exports.PaymentService = PaymentService;
PaymentService.purchaseRepository = database_1.AppDataSource.getRepository(purchase_model_1.Purchase);
PaymentService.videoRepository = database_1.AppDataSource.getRepository(video_model_1.Video);
PaymentService.userRepository = database_1.AppDataSource.getRepository(user_model_1.User);
PaymentService.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
});
