// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { AuthService, AuthError } from "../services/auth.service";

// DRY VIOLATION NOTE: This controller has several violations of the DRY principle
export class AuthController {
  static login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      // DRY VIOLATION: Field validation 2/2. Redundant with Joi schemas in auth.schema.ts. Also duplicated at line 14-22
      if (!email || !password) {
        res.status(400).json({
          status: 'error',
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.login(email, password);
      
      // Format response to match frontend expectations
      // DRY VIOLATION: Response formatting 1/3. Duplicated at lines 68-78 and 95-105
      res.json({
        status: 'success',
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role
          }
        }
      });
    } catch (error) {
      // DRY VIOLATION: Error handling 1/2. Duplicated at lines 107-115
      if (error instanceof AuthError) {
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

  static validateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        });
        return;
      }

      // DRY VIOLATION: Response formatting 2/3. Similar to lines 28-38 and 95-105
      res.json({
        status: 'success',
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  static register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      // DRY VIOLATION: Field validation 2/2. Redundant with Joi schemas in auth.schema.ts. Also duplicated at line 14-22
      if (!email || !password) {
        res.status(400).json({
          status: 'error',
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.register(email, password);
      
      // DRY VIOLATION: Response formatting 3/3. Duplicated at lines 28-38 and 68-78
      res.status(201).json({
        status: 'success',
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role
          }
        }
      });
    } catch (error) {
      // DRY VIOLATION: Error handling 2/2. Duplicated at lines 40-48
      if (error instanceof AuthError) {
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
}