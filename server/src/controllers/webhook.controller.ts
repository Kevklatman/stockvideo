import { Request, Response } from 'express';
import Stripe from 'stripe';
import { AppDataSource } from "../config/database";
import { PaymentService } from '../services/payment.service';
import { Purchase } from '../models/purchase.model';
import { User } from "../models/user.model";
import { Logger } from '../utils/logger';

interface StripeAccountDeauthorized {
  id: string;
  object: 'application';
  application: string;
  livemode: boolean;
  stripe_user_id: string;
}

export class WebhookController {
  private static readonly logger = Logger.getInstance();

  protected static getLogger(context: object) {
    return this.logger.child(context);
  }

  static async handleStripeWebhook(req: Request, res: Response) {
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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });

    const sig = req.headers['stripe-signature'];

    if (!sig) {
      logger.error('No Stripe signature found');
      return res.status(400).json({
        status: 'error',
        message: 'No signature provided'
      });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      try {
        // Handle different event types
        switch (event.type) {
          case 'payment_intent.succeeded':
            await WebhookController.handlePaymentIntentSucceeded(
              event.data.object as Stripe.PaymentIntent
            );
            break;

          case 'payment_intent.payment_failed':
            await WebhookController.handlePaymentIntentFailed(
              event.data.object as Stripe.PaymentIntent
            );
            break;

          case 'payment_intent.processing':
            await WebhookController.handlePaymentIntentProcessing(
              event.data.object as Stripe.PaymentIntent
            );
            break;

          case 'account.updated':
            await WebhookController.handleAccountUpdated(
              event.data.object as Stripe.Account
            );
            break;

          case 'account.application.deauthorized':
            await WebhookController.handleAccountDeauthorized(
              event.data.object as unknown as StripeAccountDeauthorized
            );
            break;

          default:
            logger.info('Unhandled event type', { type: event.type });
            break;
        }

        // Send success response
        res.json({ received: true });
      } catch (processingError) {
        logger.error('Error processing webhook event', {
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
          stack: processingError instanceof Error ? processingError.stack : undefined,
          eventType: event.type
        });

        // Still return 200 to acknowledge receipt
        res.status(200).json({
          received: true,
          warning: 'Event received but processing failed'
        });
      }
    } catch (signatureError) {
      logger.error('Webhook signature verification failed', {
        error: signatureError instanceof Error ? signatureError.message : 'Unknown error',
        stack: signatureError instanceof Error ? signatureError.stack : undefined
      });

      return res.status(400).json({
        status: 'error',
        message: 'Invalid signature'
      });
    }
  }

  private static async handleAccountUpdated(account: Stripe.Account) {
    const logger = WebhookController.getLogger({
      handler: 'handleAccountUpdated',
      accountId: account.id
    });

    try {
      await AppDataSource.transaction(async (transactionalEntityManager) => {
        const user = await transactionalEntityManager
          .createQueryBuilder(User, 'user')
          .where('user.stripeConnectAccountId = :accountId', {
            accountId: account.id
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!user) {
          logger.warn('No user found for Connect account', {
            accountId: account.id
          });
          return;
        }

        let newStatus: 'none' | 'pending' | 'active' | 'rejected' = 'pending';

        if (account.requirements?.disabled_reason?.includes('rejected')) {
          newStatus = 'rejected';
        } else if (account.charges_enabled && account.payouts_enabled) {
          newStatus = 'active';
        } else if (account.requirements?.disabled_reason) {
          newStatus = 'rejected';
        }

        if (user.stripeConnectAccountStatus !== newStatus) {
          user.stripeConnectAccountId = user.stripeConnectAccountId || undefined;
          user.stripeConnectAccountStatus = newStatus;
          await transactionalEntityManager.save(user);

          logger.info('Updated user Connect account status', {
            userId: user.id,
            oldStatus: user.stripeConnectAccountStatus,
            newStatus: newStatus,
            requirements: account.requirements
          });
        }
      });
    } catch (error) {
      logger.error('Failed to process account update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        accountId: account.id
      });
      throw error;
    }
  }

  private static async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const logger = WebhookController.getLogger({
      handler: 'handlePaymentIntentSucceeded',
      paymentIntentId: paymentIntent.id
    });

    try {
      await AppDataSource.transaction(async (transactionalEntityManager) => {
        const purchase = await transactionalEntityManager
          .createQueryBuilder(Purchase, 'purchase')
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
    } catch (error) {
      logger.error('Failed to process successful payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        paymentIntentId: paymentIntent.id
      });
      throw error;
    }
  }

  private static async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const logger = WebhookController.getLogger({
      handler: 'handlePaymentIntentFailed',
      paymentIntentId: paymentIntent.id
    });

    try {
      await AppDataSource.transaction(async (transactionalEntityManager) => {
        const purchase = await transactionalEntityManager
          .createQueryBuilder(Purchase, 'purchase')
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
    } catch (error) {
      logger.error('Failed to process failed payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private static async handlePaymentIntentProcessing(paymentIntent: Stripe.PaymentIntent) {
    const logger = WebhookController.getLogger({
      handler: 'handlePaymentIntentProcessing',
      paymentIntentId: paymentIntent.id
    });

    try {
      await AppDataSource.transaction(async (transactionalEntityManager) => {
        const purchase = await transactionalEntityManager
          .createQueryBuilder(Purchase, 'purchase')
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

        if (purchase.status !== 'pending') {
          purchase.status = 'pending';
          purchase.updatedAt = new Date();
          await transactionalEntityManager.save(purchase);

          logger.info('Purchase marked as pending', { purchaseId: purchase.id });
        }
      });
    } catch (error) {
      logger.error('Failed to process processing payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private static async handleAccountDeauthorized(deauthorizedEvent: StripeAccountDeauthorized) {
    const logger = WebhookController.getLogger({
      handler: 'handleAccountDeauthorized',
      stripeUserId: deauthorizedEvent.stripe_user_id
    });

    try {
      await AppDataSource.transaction(async (transactionalEntityManager) => {
        const user = await transactionalEntityManager
          .createQueryBuilder(User, 'user')
          .where('user.stripeConnectAccountId = :accountId', {
            accountId: deauthorizedEvent.stripe_user_id
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!user) {
          logger.warn('No user found for deauthorized Connect account', {
            stripeUserId: deauthorizedEvent.stripe_user_id
          });
          return;
        }

        user.stripeConnectAccountId = undefined;
        user.stripeConnectAccountStatus = 'none';
        await transactionalEntityManager.save(user);

        logger.info('Reset user Connect account after deauthorization', {
          userId: user.id,
          stripeUserId: deauthorizedEvent.stripe_user_id
        });
      });
    } catch (error) {
      logger.error('Failed to process account deauthorization', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        stripeUserId: deauthorizedEvent.stripe_user_id
      });
      throw error;
    }
  }
}