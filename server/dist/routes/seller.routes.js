"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sellerRouter = void 0;
// src/routes/seller.routes.ts
const express_1 = require("express");
const seller_controller_1 = require("../controllers/seller.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.sellerRouter = router;
// Make sure all routes are protected by auth
router.use(auth_middleware_1.authMiddleware);
// Add routes
router.post('/connect-account', (req, res, next) => seller_controller_1.SellerController.createConnectAccount(req, res, next));
router.get('/account-status', (req, res, next) => seller_controller_1.SellerController.getAccountStatus(req, res, next));
router.post('/payout-settings', (req, res, next) => seller_controller_1.SellerController.updatePayoutSettings(req, res, next));
// src/routes/seller.routes.ts
router.get('/transactions', (req, res, next) => seller_controller_1.SellerController.getTransactionHistory(req, res, next));
