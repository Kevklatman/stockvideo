// src/routes/payment.routes.ts
import express, { Router, json } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public webhook endpoint (needs raw body for Stripe signature verification)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

// Protected routes
router.use(authMiddleware);
router.use(json()); // Parse JSON for non-webhook routes

// Create payment intent
router.post('/create-intent', PaymentController.createPaymentIntent);

// Verify payment
router.get('/verify/:videoId', PaymentController.verifyPayment);

// Get purchase history
router.get('/history', PaymentController.getPurchaseHistory);

export { router as paymentRouter };