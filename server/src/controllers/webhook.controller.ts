// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { PaymentService } from '../services/payment.service';

export class WebhookController {
  static async handleStripeWebhook(req: Request, res: Response) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });

    const sig = req.headers['stripe-signature'];

    try {
      console.log('Received Stripe webhook', {
        signature: !!sig,
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body)
      });

      if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Missing webhook signature or secret');
        return res.status(400).json({
          status: 'error',
          message: 'Missing signature or secret'
        });
      }

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      console.log('Webhook event:', {
        type: event.type,
        id: event.id
      });

      await PaymentService.handleWebhook(event);
      
      res.json({ received: true });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(400).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
}