// src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError } from 'joi';

export const validateRequest = (schema: Schema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await schema.validateAsync(req.body, { abortEarly: false });
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
        return;
      }
      next(error);
    }
  };
};