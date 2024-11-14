// src/controllers/seller.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types'; // Make sure this exists
import { StripeConnectService } from '../services/stripe-connect.service';
import { AppDataSource } from '../config/database';
import { User } from '../models/user.model';

export class SellerController {
  static async createConnectAccount(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      const userEmail = (req as AuthenticatedRequest).user?.email;

      if (!userId || !userEmail) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
        return;
      }

      const account = await StripeConnectService.createConnectAccount(
        userId,
        userEmail
      );

      await AppDataSource.getRepository(User).update(userId, {
        stripeConnectAccountId: account.id,
        stripeConnectAccountStatus: 'pending'
      });

      const accountLink = await StripeConnectService.createAccountLink(
        account.id,
        `${process.env.FRONTEND_URL}/seller/onboarding/refresh`,
        `${process.env.FRONTEND_URL}/seller/onboarding/complete`
      );

      res.json({
        status: 'success',
        data: { url: accountLink.url }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAccountStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
        return;
      }

      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: userId }
      });

      res.json({
        status: 'success',
        data: {
          stripeConnectStatus: user?.stripeConnectAccountStatus || 'none'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePayoutSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;

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
    } catch (error) {
      next(error);
    }
  }

  // Example usage in seller.controller.ts
static async getTransactionHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
        return;
      }
  
      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: userId }
      });
  
      if (!user?.stripeConnectAccountId) {
        res.status(400).json({
          status: 'error',
          message: 'No Stripe Connect account found'
        });
        return;
      }
  
      const transactions = await StripeConnectService.listTransactions(
        user.stripeConnectAccountId,
        {
          limit: 20,
          type: 'payment',  // or 'transfer', 'payout', etc.
          created: {
            // Last 30 days
            gte: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
          }
        }
      );
  
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
    } catch (error) {
      next(error);
    }
  }
}