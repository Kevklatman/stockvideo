"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path = __importStar(require("path"));
const database_1 = require("./config/database");
const auth_routes_1 = require("./routes/auth.routes");
const video_routes_1 = require("./routes/video.routes");
const security_1 = require("./config/security");
const error_middleware_1 = require("./middleware/error.middleware");
const routing_controllers_1 = require("routing-controllers");
const typedi_1 = require("typedi");
const payment_routes_1 = require("./routes/payment.routes");
const webhook_routes_1 = require("./routes/webhook.routes");
const payment_service_1 = require("./services/payment.service");
const seller_routes_1 = require("./routes/seller.routes");
// Load environment variables early
dotenv_1.default.config({ path: path.join(__dirname, '../.env') });
const app = (0, express_1.default)();
exports.dynamic = 'force-dynamic';
// Verify required environment variables
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
(0, routing_controllers_1.useContainer)(typedi_1.Container);
// Trust proxy if behind reverse proxy
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
// Request logging middleware (except for webhooks)
app.use((req, res, next) => {
    if (!req.path.includes('/webhooks/')) {
        console.log(`${req.method} ${req.url}`);
    }
    next();
});
// Security middleware (except body parsing)
app.use(security_1.security.helmet);
app.use(security_1.security.securityHeaders);
// CORS middleware
app.use(security_1.security.cors);
// Webhook routes - must be before body parsing middleware
app.use('/api/webhooks', webhook_routes_1.webhookRouter);
// Body parsing middleware for non-webhook routes
app.use((req, res, next) => {
    if (req.path.includes('/webhooks/')) {
        next();
    }
    else {
        express_1.default.json({
            limit: '1mb',
            verify: (req, res, buf) => {
                req.rawBody = buf;
            }
        })(req, res, next);
    }
});
app.use((req, res, next) => {
    if (req.path.includes('/webhooks/')) {
        next();
    }
    else {
        express_1.default.urlencoded({
            extended: true,
            limit: '1mb'
        })(req, res, next);
    }
});
app.use('/api/seller', seller_routes_1.sellerRouter);
// Request sanitization
app.use(security_1.security.sanitizeRequest);
// API routes with rate limiting
const apiRouter = express_1.default.Router();
apiRouter.use('/auth', security_1.security.rateLimits.auth);
apiRouter.use('/videos/upload', security_1.security.rateLimits.upload);
apiRouter.use('/', security_1.security.rateLimits.api);
// Mount route handlers
apiRouter.use("/auth", auth_routes_1.authRouter);
apiRouter.use("/videos", video_routes_1.videoRouter);
apiRouter.use("/payments", payment_routes_1.paymentRouter);
// Mount all API routes under /api
app.use("/api", apiRouter);
// Static file serving with security headers
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}, express_1.default.static(path.join(__dirname, '../uploads')));
// Health check endpoint
app.get('/health', security_1.security.rateLimits.api, (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        environment: process.env.NODE_ENV
    });
});
// Global error handler
app.use(error_middleware_1.errorHandler);
// Handle 404
app.use((_req, res) => {
    res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Resource not found'
    });
});
// Database connection and server start
async function startServer() {
    try {
        await database_1.AppDataSource.initialize();
        console.log("Database connected");
        // Verify webhook configuration
        await payment_service_1.PaymentService.verifyWebhookConfiguration();
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("Server initialization error:", error);
        process.exit(1);
    }
}
// Graceful shutdown handler
function handleGracefulShutdown() {
    console.log('SIGTERM received. Shutting down gracefully...');
    database_1.AppDataSource.destroy()
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
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    handleGracefulShutdown();
});
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    handleGracefulShutdown();
});
exports.default = app;
