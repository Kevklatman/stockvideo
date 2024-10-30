"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = exports.security = void 0;
// src/config/security.ts
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
// Rate limit configurations
const rateLimitConfig = {
    // General API rate limit
    api: (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
    }),
    // More strict limit for auth endpoints
    auth: (0, express_rate_limit_1.default)({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // limit each IP to 5 failed requests per hour
        message: 'Too many failed attempts, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true, // Only count failed requests
    }),
    // Video upload limit
    upload: (0, express_rate_limit_1.default)({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // limit each IP to 10 uploads per hour
        message: 'Upload limit reached, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
    })
};
// CORS configuration
const corsConfig = (0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Range',
        'x-requested-with',
        'x-auth-token'
    ],
    exposedHeaders: [
        'Content-Range',
        'Content-Length',
        'Accept-Ranges'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
});
// Helmet configuration
const helmetConfig = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
});
// Request sanitization middleware
const sanitizeRequest = (req, _res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }
    next();
};
// Security headers middleware
const securityHeaders = (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
};
exports.security = {
    rateLimits: rateLimitConfig,
    cors: corsConfig,
    helmet: helmetConfig,
    sanitizeRequest,
    securityHeaders,
};
// Request validation middleware factory
const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            if (schema.body) {
                req.body = await schema.body.validate(req.body);
            }
            if (schema.query) {
                req.query = await schema.query.validate(req.query);
            }
            if (schema.params) {
                req.params = await schema.params.validate(req.params);
            }
            next();
        }
        catch (error) {
            res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                message: error.message
            });
        }
    };
};
exports.validateRequest = validateRequest;
