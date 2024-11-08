// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { handleControllerError } from '../utils/error-handler';
import Stripe from 'stripe';
import { AuthenticatedRequest } from '../types/';

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

// In PaymentController.ts
// In PaymentController.ts
static async verifyPayment(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { videoId, paymentIntentId } = req.query;

    console.log('Payment verification request:', {
      userId,
      videoId,
      paymentIntentId,
      query: req.query
    });

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!videoId || !paymentIntentId || typeof videoId !== 'string' || typeof paymentIntentId !== 'string') {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_PARAMETERS',
        message: 'Video ID and Payment Intent ID are required'
      });
    }

    const result = await PaymentService.verifyPurchase(
      userId,
      videoId,
      paymentIntentId
    );

    return res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Payment verification failed:', error);
    return handleControllerError(error, res);
  }
}
// In payment.controller.ts
static async checkPaymentStatus(req: Request, res: Response) {
  try {
    const { paymentIntentId } = req.params;
    
    if (!paymentIntentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment Intent ID is required'
      });
    }

    // Get payment intent from Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log('Payment Intent Status:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    });

    // If payment is succeeded but purchase is still pending, complete it
    if (paymentIntent.status === 'succeeded') {
      await PaymentService.completePurchase(paymentIntentId);
    }

    res.json({
      status: 'success',
      data: {
        stripeStatus: paymentIntent.status,
        metadata: paymentIntent.metadata
      }
    });
  } catch (error) {
    console.error('Payment status check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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

  static async handleWebhook(req: Request, res: Response) {
    try {
      const sig = req.headers['stripe-signature'];
      console.log('Webhook received:', {
        hasSignature: !!sig,
        contentType: req.headers['content-type'],
        bodyLength: req.body?.length
      });

      if (!sig) {
        console.error('No Stripe signature found');
        return res.status(400).json({ error: 'No Stripe signature found' });
      }

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('No webhook secret configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16'
      });

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body, // Raw body
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error('Error constructing webhook event:', err);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }

      console.log('Webhook event:', {
        type: event.type,
        id: event.id,
        data: {
          object: {
            id: (event.data.object as { id: string }).id,
            status: 'status' in event.data.object ? event.data.object.status : undefined
          }
        }
      });

      try {
        await PaymentService.handleWebhook(event);
        console.log('Webhook handled successfully');
        res.json({ received: true });
      } catch (err) {
        console.error('Error handling webhook:', err);
        // Respond with 200 to acknowledge receipt, even if processing failed
        res.status(200).json({ 
          received: true, 
          warning: 'Event received but processing failed' 
        });
      }
    } catch (err) {
      console.error('Unhandled webhook error:', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  static async getUserPurchases(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
      }

      const { page, limit, status } = req.query;

      const purchases = await PaymentService.getUserPurchases(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as 'pending' | 'completed' | 'failed' | undefined,
      });

      return res.json({
        status: 'success',
        data: purchases,
      });
    } catch (error) {
      console.error('Failed to fetch user purchases:', error);
      return handleControllerError(error, res);
    }
  }
}