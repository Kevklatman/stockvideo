// src/utils/error-handler.ts
import { Response } from 'express';
import { PaymentError, ValidationError } from '../types/errors';

export const handleControllerError = (error: unknown, res: Response) => {
  console.error('Controller error:', error);

  if (error instanceof PaymentError) {
    return res.status(400).json({
      status: 'error',
      code: 'PAYMENT_ERROR',
      message: error.message
    });
  }

  if (error instanceof ValidationError) {
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