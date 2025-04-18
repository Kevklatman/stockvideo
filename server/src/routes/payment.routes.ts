import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Update verification endpoint to match frontend expectations
router.get('/verify', PaymentController.verifyPayment);  // Keep as /verify since frontend is using query params
router.post('/create-intent', PaymentController.createPaymentIntent);
router.get('/history', PaymentController.getPurchaseHistory);
router.get('/status/:paymentIntentId', PaymentController.checkPaymentStatus);
router.get('/purchases', PaymentController.getUserPurchases);

export { router as paymentRouter };