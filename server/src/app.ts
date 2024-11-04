import 'reflect-metadata';
import express, { json, raw } from "express";
import dotenv from "dotenv";
import * as path from 'path';
import { AppDataSource } from "./config/database";
import { authRouter } from "./routes/auth.routes";
import { videoRouter } from "./routes/video.routes";
import { security } from "./config/security";
import { errorHandler } from "./middleware/error.middleware";
import { useContainer} from "routing-controllers";
import { Container } from "typedi";
import { paymentRouter } from "./routes/payment.routes";
import { PaymentController } from './controllers/payment.controller';
import { PaymentService } from './services/payment.service';
import Stripe from 'stripe';

const app = express();

// Load environment variables early
dotenv.config({ path: path.join(__dirname, '../.env') });
export const dynamic = 'force-dynamic';
const requiredEnvVars = [
  'AWS_REGION',
  'AWS_BUCKET_NAME',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Log environment variables to verify they're loaded
console.log('Environment loaded:', {
  aws: {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_BUCKET_NAME,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
  },
  stripe: {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
  },
  server: {
    port: process.env.PORT,
    env: process.env.NODE_ENV
  }
});

// Initialize reflect-metadata and dependency injection
useContainer(Container);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Trust proxy if behind reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware (except CORS and body parsing)
app.use(security.helmet);
app.use(security.securityHeaders);
app.use(express.json({limit: '1mb'})); // or any larger size you need
app.use(express.urlencoded({limit: '1mb', extended: true}));
// Stripe webhook endpoint - must be before body parsing middleware
// In your webhook route handler
// This needs to be BEFORE any body parsing middleware
// This needs to be BEFORE any other middleware that parses the body
app.post('/api/payments/webhook',
  express.raw({type: 'application/json'}),
  async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      console.log('Webhook received:', {
        hasSignature: !!sig,
        contentType: req.headers['content-type'],
        bodyLength: req.body?.length
      });

      if (!sig) {
        console.error('No Stripe signature found');
        return res.status(400).json({ error: 'No Stripe signature found' });
      }

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('No webhook secret configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16'
      });

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error('Error constructing webhook event:', err);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }

      console.log('Webhook event:', {
        type: event.type,
        id: event.id,
        data: {
          object: {
            id: (event.data.object as { id: string }).id,
            status: 'status' in event.data.object ? event.data.object.status : undefined
          }
        }
      });

      try {
        await PaymentService.handleWebhook(event);
        console.log('Webhook handled successfully');
        res.json({ received: true });
      } catch (err) {
        console.error('Error handling webhook:', err);
        // Respond with 200 to acknowledge receipt, even if processing failed
        res.status(200).json({ 
          received: true, 
          warning: 'Event received but processing failed' 
        });
      }
    } catch (err) {
      console.error('Unhandled webhook error:', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
);

// Regular CORS for all other routes
app.use(security.cors);

// Body parsing middleware for regular routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(security.sanitizeRequest);

const apiRouter = express.Router();

// Rate limiting for API routes
apiRouter.use('/auth', security.rateLimits.auth);
apiRouter.use('/videos/upload', security.rateLimits.upload);
apiRouter.use('/', security.rateLimits.api);

// Mount route handlers
apiRouter.use("/auth", authRouter);
apiRouter.use("/videos", videoRouter);
apiRouter.use("/payments", paymentRouter);

// Mount all API routes under /api
app.use("/api", apiRouter);

// Static file serving with security headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', security.rateLimits.api, (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV 
  });
});

// Global error handler
app.use(errorHandler);

// Handle 404
app.use((_req, res) => {
  res.status(404).json({ 
    status: 'error',
    code: 'NOT_FOUND',
    message: 'Resource not found' 
  });
});

// Database connection and server start
// In app.ts
async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log("Database connected");
    
    // Verify webhook configuration
    await PaymentService.verifyWebhookConfiguration();
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server initialization error:", error);
    process.exit(1);
  }
}

// Graceful shutdown handler
function handleGracefulShutdown() {
  console.log('SIGTERM received. Shutting down gracefully...');
  AppDataSource.destroy()
    .then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
}

// Initialize server
startServer();

// Register shutdown handlers
process.on('SIGTERM', handleGracefulShutdown);
process.on('SIGINT', handleGracefulShutdown);

export default app;