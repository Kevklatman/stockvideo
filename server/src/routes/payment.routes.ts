import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protected routes - webhook is handled in app.ts
router.use(authMiddleware);

// Create payment intent endpoint
router.post('/create-intent', PaymentController.createPaymentIntent);

// Get purchase history
router.get('/history', PaymentController.getPurchaseHistory);

// Add route for verifying payment
router.get('/verify', PaymentController.verifyPayment);

export { router as paymentRouter };