// src/routes/seller.routes.ts
import { Router } from 'express';
import { SellerController } from '../controllers/seller.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Make sure all routes are protected by auth
router.use(authMiddleware);

// Add routes
router.post('/connect-account', 
  (req, res, next) => SellerController.createConnectAccount(req, res, next)
);

router.get('/account-status', 
  (req, res, next) => SellerController.getAccountStatus(req, res, next)
);

router.post('/payout-settings', 
  (req, res, next) => SellerController.updatePayoutSettings(req, res, next)
);
// src/routes/seller.routes.ts
router.get('/transactions', 
    (req, res, next) => SellerController.getTransactionHistory(req, res, next)
  );
export { router as sellerRouter };