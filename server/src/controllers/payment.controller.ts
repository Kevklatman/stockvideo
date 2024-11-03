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

  static async handleWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const sig = req.headers['stripe-signature'];
      
      console.log('Processing webhook:', {
        hasSignature: !!sig,
        signatureValue: sig,
        bodyType: typeof req.body,
        bodyLength: req.body?.length,
        webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
      });

      if (!sig || typeof sig !== 'string') {
        console.error('Missing or invalid Stripe signature');
        return res.status(400).json({
          status: 'error',
          message: 'Missing Stripe signature'
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16'
      });

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
        
        console.log('Webhook event constructed:', {
          type: event.type,
          id: event.id,
          object: event.data.object
        });

      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).json({
          status: 'error',
          message: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`
        });
      }

      await PaymentService.handleWebhook(event);
      
      return res.json({
        status: 'success',
        received: true
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown webhook processing error'
      });
    }
  }

// In payment.controller.ts
static async verifyPayment(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { paymentIntentId } = req.params; // Use paymentIntentId from params

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    console.log('Verifying payment:', { userId, paymentIntentId });

    const result = await PaymentService.verifyPayment(userId, paymentIntentId);

    return res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
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