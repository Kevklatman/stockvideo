"use strict";
// src/types/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadError = exports.StorageError = exports.VideoError = exports.PaymentError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ApiException = exports.BaseError = void 0;
class BaseError extends Error {
    constructor(message, code, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
class ApiException extends BaseError {
    constructor(message, code, status, errors) {
        super(message, code, status);
        this.errors = errors;
    }
}
exports.ApiException = ApiException;
class ValidationError extends BaseError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR', 400);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends BaseError {
    constructor(message) {
        super(message, 'AUTHENTICATION_ERROR', 401);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends BaseError {
    constructor(message) {
        super(message, 'AUTHORIZATION_ERROR', 403);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends BaseError {
    constructor(message) {
        super(message, 'NOT_FOUND', 404);
    }
}
exports.NotFoundError = NotFoundError;
class PaymentError extends BaseError {
    constructor(message) {
        super(message, 'PAYMENT_ERROR', 402);
    }
}
exports.PaymentError = PaymentError;
class VideoError extends BaseError {
    constructor(message, code = 'VIDEO_ERROR', status = 400) {
        super(message, code, status);
    }
}
exports.VideoError = VideoError;
class StorageError extends BaseError {
    constructor(message) {
        super(message, 'STORAGE_ERROR', 500);
    }
}
exports.StorageError = StorageError;
class UploadError extends BaseError {
    constructor(message) {
        super(message, 'UPLOAD_ERROR', 400);
    }
}
exports.UploadError = UploadError;
