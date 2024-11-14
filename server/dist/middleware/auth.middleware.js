"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const auth_service_1 = require("../services/auth.service");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log('Auth header present:', !!authHeader);
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({
                status: 'error',
                code: 'UNAUTHORIZED',
                message: "No token provided"
            });
            return;
        }
        const token = authHeader.split(" ")[1];
        try {
            // Use AuthService to validate token and get user data
            const userData = await auth_service_1.AuthService.validateToken(token);
            // Set user data in request
            req.user = userData;
            // Log successful authentication
            console.log('User authenticated:', {
                id: userData.id,
                email: userData.email,
                role: userData.role
            });
            next();
        }
        catch (error) {
            console.error('Token validation error:', error);
            res.status(401).json({
                status: 'error',
                code: 'INVALID_TOKEN',
                message: "Invalid or expired token"
            });
            return;
        }
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        if (error instanceof Error) {
            res.status(500).json({
                status: 'error',
                code: 'AUTH_ERROR',
                message: error.message
            });
            return;
        }
        next(error);
    }
};
exports.authMiddleware = authMiddleware;
