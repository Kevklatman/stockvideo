// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: "No token provided"
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        status: 'error',
        code: 'SERVER_ERROR',
        message: "JWT secret not configured"
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, secret) as {
        id: string;
        email: string;
        role: string;
      };

      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        status: 'error',
        code: 'INVALID_TOKEN',
        message: "Invalid or expired token"
      });
      return;
    }
  } catch (error) {
    next(error);
  }
};