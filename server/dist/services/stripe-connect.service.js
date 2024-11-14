"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeConnectService = void 0;
// src/services/stripe-connect.service.ts
const stripe_1 = __importDefault(require("stripe"));
const database_1 = require("../config/database");
const user_model_1 = require("../models/user.model");
const errors_1 = require("../types/errors");
class StripeConnectService {
    static async createConnectAccount(userId, email) {
        try {
            // First check if user already has an account
            const user = await this.userRepository.findOne({
                where: { id: userId }
            });
            if (user?.stripeConnectAccountId) {
                throw new errors_1.PaymentError('User already has a Connect account');
            }
            // Create Stripe Connect Express account
            const account = await this.stripe.accounts.create({
                type: 'express',
                country: 'US', // You might want to make this configurable
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                metadata: {
                    userId: userId
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'manual' // Or 'daily', 'weekly', etc.
                        }
                    }
                }
            });
            // Update user record with Connect account ID
            await this.userRepository.update(userId, {
                stripeConnectAccountId: account.id,
                stripeConnectAccountStatus: 'pending'
            });
            return account;
        }
        catch (error) {
            console.error('Error creating Connect account:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to create Connect account');
        }
    }
    static async createAccountLink(accountId, refreshUrl, returnUrl) {
        try {
            return await this.stripe.accountLinks.create({
                account: accountId,
                refresh_url: refreshUrl,
                return_url: returnUrl,
                type: 'account_onboarding'
            });
        }
        catch (error) {
            console.error('Error creating account link:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to create account link');
        }
    }
    static async getAccountStatus(accountId) {
        try {
            const account = await this.stripe.accounts.retrieve(accountId);
            return {
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirements: account.requirements
            };
        }
        catch (error) {
            console.error('Error retrieving account status:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to get account status');
        }
    }
    static async createLoginLink(accountId) {
        try {
            return await this.stripe.accounts.createLoginLink(accountId);
        }
        catch (error) {
            console.error('Error creating login link:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to create login link');
        }
    }
    static async getBalance(accountId) {
        try {
            return await this.stripe.balance.retrieve({
                stripeAccount: accountId
            });
        }
        catch (error) {
            console.error('Error retrieving balance:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to get balance');
        }
    }
    // src/services/stripe-connect.service.ts
    static async listTransactions(accountId, params = {}) {
        try {
            return await this.stripe.balanceTransactions.list({
                ...params,
                limit: params.limit || 10,
                // The stripeAccount parameter should be passed in the options object
            }, {
                stripeAccount: accountId // Moved here as part of RequestOptions
            });
        }
        catch (error) {
            console.error('Error listing transactions:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to list transactions');
        }
    }
    static async createPayout(accountId, amount) {
        try {
            return await this.stripe.payouts.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'usd'
            }, {
                stripeAccount: accountId
            });
        }
        catch (error) {
            console.error('Error creating payout:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to create payout');
        }
    }
    static async handleAccountUpdate(event) {
        const account = event.data.object;
        const userId = account.metadata?.userId;
        if (!userId) {
            console.error('No userId found in account metadata');
            return;
        }
        if (!userId) {
            console.error('No userId found in account metadata');
            return;
        }
        try {
            await this.userRepository.update(userId, {
                stripeConnectAccountStatus: account.charges_enabled ? 'active' : 'pending'
            });
        }
        catch (error) {
            console.error('Error updating user Connect status:', error);
            throw new errors_1.PaymentError(error instanceof Error ? error.message : 'Failed to update account status');
        }
    }
}
exports.StripeConnectService = StripeConnectService;
StripeConnectService.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
});
StripeConnectService.userRepository = database_1.AppDataSource.getRepository(user_model_1.User);
