"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageError = exports.ValidationError = exports.VideoAccessError = exports.PaymentError = exports.VideoProcessingError = exports.BaseError = void 0;
// Error classes
class BaseError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
class VideoProcessingError extends BaseError {
    constructor(message) {
        super(message, 'VIDEO_PROCESSING_ERROR');
    }
}
exports.VideoProcessingError = VideoProcessingError;
class PaymentError extends BaseError {
    constructor(message) {
        super(message, 'PAYMENT_ERROR');
    }
}
exports.PaymentError = PaymentError;
class VideoAccessError extends BaseError {
    constructor(message) {
        super(message, 'VIDEO_ACCESS_ERROR');
    }
}
exports.VideoAccessError = VideoAccessError;
class ValidationError extends BaseError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
class StorageError extends BaseError {
    constructor(message) {
        super(message, 'STORAGE_ERROR');
    }
}
exports.StorageError = StorageError;
