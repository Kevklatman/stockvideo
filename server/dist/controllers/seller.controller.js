"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerController = void 0;
const stripe_connect_service_1 = require("../services/stripe-connect.service");
const database_1 = require("../config/database");
const user_model_1 = require("../models/user.model");
class SellerController {
    // src/controllers/seller.controller.ts
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
            // Check if user already has a Connect account
            const user = await database_1.AppDataSource.getRepository(user_model_1.User).findOne({
                where: { id: userId }
            });
            if (user?.stripeConnectAccountId) {
                // If account exists but is pending, create a new account link
                if (user.stripeConnectAccountStatus === 'pending') {
                    const accountLink = await stripe_connect_service_1.StripeConnectService.refreshAccountLink(user.stripeConnectAccountId);
                    res.json({
                        status: 'success',
                        data: {
                            url: accountLink,
                            status: 'pending'
                        }
                    });
                    return;
                }
                res.status(400).json({
                    status: 'error',
                    code: 'ACCOUNT_EXISTS',
                    message: 'User already has a Connect account'
                });
                return;
            }
            // Create new account if one doesn't exist
            const account = await stripe_connect_service_1.StripeConnectService.createConnectAccount(userId, userEmail);
            const accountLink = await stripe_connect_service_1.StripeConnectService.createAccountLink(account.id, `${process.env.FRONTEND_URL}/seller/onboarding/refresh`, `${process.env.FRONTEND_URL}/seller/onboarding/complete`);
            res.json({
                status: 'success',
                data: {
                    url: accountLink.url,
                    status: 'new'
                }
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
            if (!user?.stripeConnectAccountId) {
                res.json({
                    status: 'success',
                    data: {
                        stripeConnectStatus: 'none'
                    }
                });
                return;
            }
            // Get detailed account status from Stripe
            const accountStatus = await stripe_connect_service_1.StripeConnectService.getAccountStatus(user.stripeConnectAccountId);
            let status = user.stripeConnectAccountStatus;
            // Update status based on Stripe account state
            if (accountStatus.detailsSubmitted && accountStatus.chargesEnabled) {
                status = 'active';
                // Update user record if status has changed
                if (user.stripeConnectAccountStatus !== 'active') {
                    await database_1.AppDataSource.getRepository(user_model_1.User).update(userId, {
                        stripeConnectAccountStatus: 'active'
                    });
                }
            }
            res.json({
                status: 'success',
                data: {
                    stripeConnectStatus: status,
                    requirements: accountStatus.requirements
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
