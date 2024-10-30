"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageError = exports.ValidationError = exports.AuthError = exports.PaymentError = exports.VideoAccessError = exports.VideoProcessingError = void 0;
// src/types/errors.ts
class VideoProcessingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VideoProcessingError';
    }
}
exports.VideoProcessingError = VideoProcessingError;
class VideoAccessError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VideoAccessError';
    }
}
exports.VideoAccessError = VideoAccessError;
class PaymentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PaymentError';
    }
}
exports.PaymentError = PaymentError;
class AuthError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class StorageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'StorageError';
    }
}
exports.StorageError = StorageError;
