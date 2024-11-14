"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const multer_1 = require("multer");
const errors_1 = require("../types/errors");
const errorHandler = (err, _req, res, _next) => {
    console.error('Error:', {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
    let response = {
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message
    };
    let statusCode = 500;
    // Handle different error types
    if (err instanceof errors_1.BaseError) {
        statusCode = err.status || 500;
        response = {
            status: 'error',
            code: err.code,
            message: err.message
        };
    }
    if (err instanceof errors_1.ApiException) {
        response.errors = err.errors;
    }
    // Handle Multer upload errors
    if (err instanceof multer_1.MulterError) {
        statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        response = {
            status: 'error',
            code: err.code,
            message: err.message
        };
    }
    // Add stack trace in development
    if (process.env.NODE_ENV !== 'production') {
        response.stack = err.stack;
    }
    // Send error response
    res.status(statusCode).json(response);
    // Log error if it's a server error
    if (statusCode >= 500) {
        console.error('Server Error:', {
            error: err,
            statusCode,
            response
        });
    }
};
exports.errorHandler = errorHandler;
