"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
}
exports.AuthController = AuthController;
_a = AuthController;
AuthController.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Email and password are required'
            });
            return;
        }
        const result = await auth_service_1.AuthService.login(email, password);
        // Format response to match frontend expectations
        res.json({
            status: 'success',
            data: {
                token: result.token,
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    role: result.user.role
                }
            }
        });
    }
    catch (error) {
        if (error instanceof auth_service_1.AuthError) {
            const statusCode = error.code === 'INVALID_CREDENTIALS' ? 401 : 400;
            res.status(statusCode).json({
                status: 'error',
                code: error.code,
                message: error.message
            });
            return;
        }
        next(error);
    }
};
AuthController.validateToken = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({
                status: 'error',
                code: 'UNAUTHORIZED',
                message: 'Invalid token'
            });
            return;
        }
        res.json({
            status: 'success',
            data: {
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    role: req.user.role
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
AuthController.register = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({
                status: 'error',
                code: 'MISSING_FIELDS',
                message: 'Email and password are required'
            });
            return;
        }
        const result = await auth_service_1.AuthService.register(email, password);
        res.status(201).json({
            status: 'success',
            data: {
                token: result.token,
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    role: result.user.role
                }
            }
        });
    }
    catch (error) {
        if (error instanceof auth_service_1.AuthError) {
            const statusCode = error.code === 'EMAIL_EXISTS' ? 409 : 400;
            res.status(statusCode).json({
                status: 'error',
                code: error.code,
                message: error.message
            });
            return;
        }
        next(error);
    }
};
