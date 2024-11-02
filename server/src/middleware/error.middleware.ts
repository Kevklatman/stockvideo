// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { 
  BaseError, 
  ApiException, 
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  PaymentError,
  VideoError,
  StorageError,
  UploadError 
} from '../types/errors';

// Error response type
interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  stack?: string;
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  let response: ErrorResponse = {
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred'
      : err.message
  };

  let statusCode = 500;

  // Handle different error types
  if (err instanceof BaseError) {
    statusCode = err.status || 500;
    response = {
      status: 'error',
      code: err.code,
      message: err.message
    };
  }

  if (err instanceof ApiException) {
    response.errors = err.errors;
  }

  // Handle Multer upload errors
  if (err instanceof MulterError) {
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