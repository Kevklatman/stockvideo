"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleControllerError = void 0;
const errors_1 = require("../types/errors");
const handleControllerError = (error, res) => {
    console.error('Controller error:', error);
    if (error instanceof errors_1.PaymentError) {
        return res.status(400).json({
            status: 'error',
            code: 'PAYMENT_ERROR',
            message: error.message
        });
    }
    if (error instanceof errors_1.ValidationError) {
        return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            message: error.message
        });
    }
    return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
};
exports.handleControllerError = handleControllerError;
