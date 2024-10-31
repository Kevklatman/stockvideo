// src/services/auth.service.ts
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/database";
import { User } from "../models/user.model";

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  private static userRepository = AppDataSource.getRepository(User);

  private static validatePassword(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);
    
    return password.length >= minLength &&
           hasUpperCase && hasLowerCase &&
           hasNumbers && hasSpecialChar;
  }

  private static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static async emailExists(email: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ 
      where: { email: email.toLowerCase() } 
    });
    return !!user;
  }

  static async register(email: string, password: string): Promise<RegisterResponse> {
    try {
      // Validate email format
      if (!this.validateEmail(email)) {
        throw new AuthError("Invalid email format", "INVALID_EMAIL");
      }

      // Validate password strength
      if (!this.validatePassword(password)) {
        throw new AuthError(
          "Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters",
          "WEAK_PASSWORD"
        );
      }

      // Check if email already exists
      const exists = await this.emailExists(email);
      if (exists) {
        throw new AuthError("Email already registered", "EMAIL_EXISTS");
      }

      // Create new user
      const user = new User();
      user.email = email.toLowerCase();
      user.passwordHash = password; // Will be hashed via @BeforeInsert hook
      user.role = "user"; // Default role

      // Save user to database
      const savedUser = await this.userRepository.save(user);

      // Generate JWT token
      const token = this.generateToken(savedUser);

      return {
        token,
        user: {
          id: savedUser.id,
          email: savedUser.email,
          role: savedUser.role
        }
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      // Log the error here if you have a logging service
      throw new AuthError("Registration failed", "REGISTRATION_FAILED");
    }
  }

  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      // Validate email format
      if (!this.validateEmail(email)) {
        throw new AuthError("Invalid email format", "INVALID_EMAIL");
      }

      // Find user
      const user = await this.userRepository.findOne({ 
        where: { email: email.toLowerCase() } 
      });

      if (!user) {
        throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Validate password
      const isValid = await user.validatePassword(password);
      if (!isValid) {
        throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      // Log the error here if you have a logging service
      throw new AuthError("Login failed", "LOGIN_FAILED");
    }
  }

  private static generateToken(user: User): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AuthError("JWT secret not configured", "CONFIG_ERROR");
    }

    try {
      return jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        secret,
        { 
          expiresIn: "24h",
          algorithm: "HS256"
        }
      );
    } catch (error) {
      throw new AuthError("Token generation failed", "TOKEN_GENERATION_FAILED");
    }
  }

  static async validateToken(token: string): Promise<{
    id: string;
    email: string;
    role: string;
  }> {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new AuthError("JWT secret not configured", "CONFIG_ERROR");
      }
  
      // Verify the token
      const decoded = jwt.verify(token, secret) as {
        id: string;
        email: string;
        role: string;
      };
  
      // Verify user still exists in database
      const user = await this.userRepository.findOne({
        where: { id: decoded.id }
      });
  
      if (!user) {
        throw new AuthError("User not found", "USER_NOT_FOUND");
      }
  
      // Log successful validation
      console.log('Token validated for user:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      });
  
      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };
    } catch (error) {
      // Enhanced error handling
      console.error('Token validation error:', error);
  
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError("Invalid token", "INVALID_TOKEN");
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError("Token expired", "TOKEN_EXPIRED");
      }
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError("Token validation failed", "TOKEN_VALIDATION_FAILED");
    }
  }
}