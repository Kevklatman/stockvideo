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
// src/app.ts
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
dotenv_1.default.config();
// Initialize reflect-metadata
(0, routing_controllers_1.useContainer)(typedi_1.Container);
const app = (0, express_1.default)();
// Basic middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Security middleware
app.use(security_1.security.helmet);
app.use(security_1.security.cors);
app.use(security_1.security.securityHeaders);
app.use(security_1.security.sanitizeRequest);
// Rate limiting
app.use('/api/auth', security_1.security.rateLimits.auth);
app.use('/api/videos/upload', security_1.security.rateLimits.upload);
app.use('/api', security_1.security.rateLimits.api);
// Trust proxy if behind reverse proxy
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
// Routes
app.use("/api/auth", auth_routes_1.authRouter);
app.use("/api/videos", video_routes_1.videoRouter);
// Serve static files with security headers
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}, express_1.default.static(path.join(__dirname, '../uploads')));
// Health check endpoint with rate limit
app.get('/health', security_1.security.rateLimits.api, (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        environment: process.env.NODE_ENV
    });
});
// Global error handler
app.use((err, req, res, next) => {
    (0, error_middleware_1.errorHandler)(err, req, res, next);
});
// Handle 404
app.use((_req, res) => {
    res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Resource not found'
    });
});
// Database connection and server start
database_1.AppDataSource.initialize()
    .then(() => {
    console.log("Database connected");
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})
    .catch((error) => console.log("TypeORM initialization error: ", error));
// Graceful shutdown
process.on('SIGTERM', () => {
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
});
exports.default = app;
