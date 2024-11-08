// src/routes/webhook.routes.ts
import express from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = express.Router();

// Raw body parser specific to Stripe webhooks
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }), 
  WebhookController.handleStripeWebhook
);

export { router as webhookRouter };