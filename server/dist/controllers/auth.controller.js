"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
}
exports.AuthController = AuthController;
_a = AuthController;
/**
 * Handle user registration
 */
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
            data: result
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
/**
 * Handle user login
 */
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
        res.json({
            status: 'success',
            data: result
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
