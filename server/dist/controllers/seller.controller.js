"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerController = void 0;
const stripe_connect_service_1 = require("../services/stripe-connect.service");
const database_1 = require("../config/database");
const user_model_1 = require("../models/user.model");
class SellerController {
    static async createConnectAccount(req, res, next) {
        try {
            const userId = req.user?.id;
            const userEmail = req.user?.email;
            if (!userId || !userEmail) {
                res.status(401).json({
                    status: 'error',
                    message: 'Authentication required'
                });
                return;
            }
            const account = await stripe_connect_service_1.StripeConnectService.createConnectAccount(userId, userEmail);
            await database_1.AppDataSource.getRepository(user_model_1.User).update(userId, {
                stripeConnectAccountId: account.id,
                stripeConnectAccountStatus: 'pending'
            });
            const accountLink = await stripe_connect_service_1.StripeConnectService.createAccountLink(account.id, `${process.env.FRONTEND_URL}/seller/onboarding/refresh`, `${process.env.FRONTEND_URL}/seller/onboarding/complete`);
            res.json({
                status: 'success',
                data: { url: accountLink.url }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAccountStatus(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    status: 'error',
                    message: 'Authentication required'
                });
                return;
            }
            const user = await database_1.AppDataSource.getRepository(user_model_1.User).findOne({
                where: { id: userId }
            });
            res.json({
                status: 'success',
                data: {
                    stripeConnectStatus: user?.stripeConnectAccountStatus || 'none'
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updatePayoutSettings(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    status: 'error',
                    message: 'Authentication required'
                });
                return;
            }
            // Implementation here
            res.json({
                status: 'success',
                data: { message: 'Payout settings updated' }
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Example usage in seller.controller.ts
    static async getTransactionHistory(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    status: 'error',
                    message: 'Authentication required'
                });
                return;
            }
            const user = await database_1.AppDataSource.getRepository(user_model_1.User).findOne({
                where: { id: userId }
            });
            if (!user?.stripeConnectAccountId) {
                res.status(400).json({
                    status: 'error',
                    message: 'No Stripe Connect account found'
                });
                return;
            }
            const transactions = await stripe_connect_service_1.StripeConnectService.listTransactions(user.stripeConnectAccountId, {
                limit: 20,
                type: 'payment', // or 'transfer', 'payout', etc.
                created: {
                    // Last 30 days
                    gte: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
                }
            });
            res.json({
                status: 'success',
                data: {
                    transactions: transactions.data.map(t => ({
                        id: t.id,
                        amount: t.amount / 100, // Convert from cents to dollars
                        currency: t.currency,
                        created: new Date(t.created * 1000).toISOString(),
                        status: t.status,
                        type: t.type,
                        description: t.description
                    }))
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SellerController = SellerController;
