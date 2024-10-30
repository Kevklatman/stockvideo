// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { AuthService, AuthError } from "../services/auth.service";

export class AuthController {
  static register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        res.status(400).json({
          status: 'error',
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.register(email, password);
      
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

  static login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        res.status(400).json({
          status: 'error',
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        });
        return;
      }

      const result = await AuthService.login(email, password);
      
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
}