// src/services/stripe-connect.service.ts
import Stripe from 'stripe';
import { AppDataSource } from "../config/database";
import { User } from "../models/user.model";
import { PaymentError } from "../types/errors";

export class StripeConnectService {
  private static stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16'
  });

  private static userRepository = AppDataSource.getRepository(User);

// src/services/stripe-connect.service.ts

static async createConnectAccount(userId: string, email: string) {
  try {
    // Verify Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new PaymentError('Stripe secret key not configured');
    }

    // First check if user already has an account
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (user?.stripeConnectAccountId) {
      throw new PaymentError('User already has a Connect account');
    }

    // Create Stripe Connect Express account
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'US', // Make this configurable if needed
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
            interval: 'manual'
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
  } catch (error) {
    console.error('Error creating Connect account:', error);
    if (error instanceof Stripe.errors.StripeError) {
      throw new PaymentError(error.message);
    }
    throw new PaymentError(
      error instanceof Error ? error.message : 'Failed to create Connect account'
    );
  }
}

  static async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string
  ) {
    try {
      return await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      });
    } catch (error) {
      console.error('Error creating account link:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to create account link'
      );
    }
  }

  static async getAccountStatus(accountId: string) {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements
      };
    } catch (error) {
      console.error('Error retrieving account status:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to get account status'
      );
    }
  }
  static async refreshAccountLink(accountId: string): Promise<string> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.FRONTEND_URL}/seller/onboarding/refresh`,
        return_url: `${process.env.FRONTEND_URL}/seller/onboarding/complete`,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      console.error('Error creating account link:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to create account link'
      );
    }}
// src/services/stripe-connect.service.ts
  static async createLoginLink(accountId: string) {
    try {
      return await this.stripe.accounts.createLoginLink(accountId);
    } catch (error) {
      console.error('Error creating login link:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to create login link'
      );
    }
  }

  static async getBalance(accountId: string) {
    try {
      return await this.stripe.balance.retrieve({
        stripeAccount: accountId
      });
    } catch (error) {
      console.error('Error retrieving balance:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to get balance'
      );
    }
  }

 // src/services/stripe-connect.service.ts

static async listTransactions(accountId: string, params: Stripe.BalanceTransactionListParams = {}) {
    try {
      return await this.stripe.balanceTransactions.list({
        ...params,
        limit: params.limit || 10,
        // The stripeAccount parameter should be passed in the options object
      }, {
        stripeAccount: accountId // Moved here as part of RequestOptions
      });
    } catch (error) {
      console.error('Error listing transactions:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to list transactions'
      );
    }
  }

  static async createPayout(accountId: string, amount: number) {
    try {
      return await this.stripe.payouts.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd'
      }, {
        stripeAccount: accountId
      });
    } catch (error) {
      console.error('Error creating payout:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to create payout'
      );
    }
  }

  static async handleAccountUpdate(event: Stripe.Event) {
    const account = event.data.object as Stripe.Account;
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
    } catch (error) {
      console.error('Error updating user Connect status:', error);
      throw new PaymentError(
        error instanceof Error ? error.message : 'Failed to update account status'
      );
    }
  }
}