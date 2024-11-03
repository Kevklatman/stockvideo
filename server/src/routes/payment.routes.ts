// src/routes/payment.routes.ts
import express, { Router, json } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Create a raw body buffer for webhook verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // This needs to be before any JSON middleware
  PaymentController.handleWebhook
);

// Use JSON middleware for other routes
router.use(json());
router.use(authMiddleware);

router.post('/create-intent', PaymentController.createPaymentIntent);
router.get('/verify/:videoId', PaymentController.verifyPayment);
router.get('/history', PaymentController.getPurchaseHistory);

export { router as paymentRouter };