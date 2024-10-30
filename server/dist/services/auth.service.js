"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.AuthError = void 0;
// src/services/auth.service.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const user_model_1 = require("../models/user.model");
class AuthError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
class AuthService {
    static validatePassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*]/.test(password);
        return password.length >= minLength &&
            hasUpperCase && hasLowerCase &&
            hasNumbers && hasSpecialChar;
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static async emailExists(email) {
        const user = await this.userRepository.findOne({
            where: { email: email.toLowerCase() }
        });
        return !!user;
    }
    static async register(email, password) {
        try {
            // Validate email format
            if (!this.validateEmail(email)) {
                throw new AuthError("Invalid email format", "INVALID_EMAIL");
            }
            // Validate password strength
            if (!this.validatePassword(password)) {
                throw new AuthError("Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters", "WEAK_PASSWORD");
            }
            // Check if email already exists
            const exists = await this.emailExists(email);
            if (exists) {
                throw new AuthError("Email already registered", "EMAIL_EXISTS");
            }
            // Create new user
            const user = new user_model_1.User();
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
        }
        catch (error) {
            if (error instanceof AuthError) {
                throw error;
            }
            // Log the error here if you have a logging service
            throw new AuthError("Registration failed", "REGISTRATION_FAILED");
        }
    }
    static async login(email, password) {
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
        }
        catch (error) {
            if (error instanceof AuthError) {
                throw error;
            }
            // Log the error here if you have a logging service
            throw new AuthError("Login failed", "LOGIN_FAILED");
        }
    }
    static generateToken(user) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new AuthError("JWT secret not configured", "CONFIG_ERROR");
        }
        try {
            return jsonwebtoken_1.default.sign({
                id: user.id,
                email: user.email,
                role: user.role
            }, secret, {
                expiresIn: "24h",
                algorithm: "HS256"
            });
        }
        catch (error) {
            throw new AuthError("Token generation failed", "TOKEN_GENERATION_FAILED");
        }
    }
    static async validateToken(token) {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new AuthError("JWT secret not configured", "CONFIG_ERROR");
            }
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            // Optionally verify user still exists and is active
            const user = await this.userRepository.findOne({
                where: { id: decoded.id }
            });
            if (!user) {
                throw new AuthError("User not found", "USER_NOT_FOUND");
            }
            return {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role
            };
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new AuthError("Invalid token", "INVALID_TOKEN");
            }
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new AuthError("Token expired", "TOKEN_EXPIRED");
            }
            throw new AuthError("Token validation failed", "TOKEN_VALIDATION_FAILED");
        }
    }
}
exports.AuthService = AuthService;
AuthService.userRepository = database_1.AppDataSource.getRepository(user_model_1.User);
