// src/routes/payment.routes.ts
import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protected routes only - webhook is handled in app.ts
router.use(authMiddleware);
router.post('/create-intent', PaymentController.createPaymentIntent);
router.get('/verify/:videoId', PaymentController.verifyPayment);

router.get('/history', PaymentController.getPurchaseHistory);
router.get('/verify/:paymentIntentId', PaymentController.verifyPayment);

export { router as paymentRouter };