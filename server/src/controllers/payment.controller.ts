// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { PaymentError } from '../types/errors';
import { handleControllerError } from '../utils/error-handler';
import Stripe from 'stripe';

export class PaymentController {
  static async createPaymentIntent(req: AuthRequest, res: Response) {
    try {
      const { videoId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      if (!videoId) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_VIDEO_ID',
          message: 'Video ID is required'
        });
      }

      console.log('Creating payment intent:', { userId, videoId });

      const paymentIntent = await PaymentService.createPaymentIntent(userId, videoId);

      console.log('Payment intent created successfully:', paymentIntent);

      return res.json({
        status: 'success',
        data: paymentIntent
      });
    } catch (error) {
      console.error('Payment intent creation failed:', error);
      return handleControllerError(error, res);
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    try {
      const sig = req.headers['stripe-signature'];

      if (!sig || typeof sig !== 'string') {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_SIGNATURE',
          message: 'Stripe signature is required'
        });
      }

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('Stripe webhook secret is not configured');
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16'
      });

      console.log('Constructing webhook event...');

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      console.log('Webhook event received:', {
        type: event.type,
        id: event.id
      });

      await PaymentService.handleWebhook(event);

      return res.json({
        status: 'success',
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return handleControllerError(error, res);
    }
  }

  static async verifyPayment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { videoId } = req.params;

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      if (!videoId) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_VIDEO_ID',
          message: 'Video ID is required'
        });
      }

      console.log('Verifying payment:', { userId, videoId });

      const verified = await PaymentService.verifyPurchase(userId, videoId, purchaseId);

      console.log('Payment verification result:', { verified });

      return res.json({
        status: 'success',
        data: { verified }
      });
    } catch (error) {
      console.error('Payment verification failed:', error);
      return handleControllerError(error, res);
    }
  }

  static async getPurchaseHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      const { page, limit, status } = req.query;
      
      console.log('Fetching purchase history:', { userId, page, limit, status });

      const purchases = await PaymentService.getUserPurchases(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as 'pending' | 'completed' | 'failed' | undefined
      });

      return res.json({
        status: 'success',
        data: purchases
      });
    } catch (error) {
      console.error('Purchase history fetch failed:', error);
      return handleControllerError(error, res);
    }
  }
}