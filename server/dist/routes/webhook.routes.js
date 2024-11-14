"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRouter = void 0;
// src/routes/webhook.routes.ts
const express_1 = __importDefault(require("express"));
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = express_1.default.Router();
exports.webhookRouter = router;
// Raw body parser specific to Stripe webhooks
router.post('/stripe', express_1.default.raw({ type: 'application/json' }), webhook_controller_1.WebhookController.handleStripeWebhook);
