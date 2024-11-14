"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.paymentRouter = router;
router.use(auth_middleware_1.authMiddleware);
// Update verification endpoint to match frontend expectations
router.get('/verify', payment_controller_1.PaymentController.verifyPayment); // Keep as /verify since frontend is using query params
router.post('/create-intent', payment_controller_1.PaymentController.createPaymentIntent);
router.get('/history', payment_controller_1.PaymentController.getPurchaseHistory);
router.get('/status/:paymentIntentId', payment_controller_1.PaymentController.checkPaymentStatus);
router.get('/purchases', payment_controller_1.PaymentController.getUserPurchases);
