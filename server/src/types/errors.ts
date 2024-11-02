// src/types/errors.ts

export class BaseError extends Error {
  constructor(message: string, public code: string, public status?: number) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ApiException extends BaseError {
  errors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    code: string,
    status?: number,
    errors?: Array<{ field: string; message: string }>
  ) {
    super(message, code, status);
    this.errors = errors;
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}

export class PaymentError extends BaseError {
  constructor(message: string) {
    super(message, 'PAYMENT_ERROR', 402);
  }
}

export class VideoError extends BaseError {
  constructor(message: string, code: string = 'VIDEO_ERROR', status: number = 400) {
    super(message, code, status);
  }
}

export class StorageError extends BaseError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR', 500);
  }
}

export class UploadError extends BaseError {
  constructor(message: string) {
    super(message, 'UPLOAD_ERROR', 400);
  }
}