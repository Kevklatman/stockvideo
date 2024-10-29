"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const user_model_1 = require("../models/user.model");
class AuthService {
    static async register(email, password) {
        // Check if user already exists
        const existingUser = await this.userRepository.findOne({
            where: { email }
        });
        if (existingUser) {
            throw new Error("User with this email already exists");
        }
        // Create new user
        const user = new user_model_1.User();
        user.email = email;
        user.passwordHash = password; // Will be hashed via @BeforeInsert hook
        // Save user to database
        const savedUser = await this.userRepository.save(user);
        // Generate JWT token
        return this.generateToken(savedUser);
    }
    static async login(email, password) {
        // Find user
        const user = await this.userRepository.findOne({
            where: { email }
        });
        if (!user) {
            throw new Error("User not found");
        }
        // Validate password
        const isValid = await user.validatePassword(password);
        if (!isValid) {
            throw new Error("Invalid password");
        }
        // Generate JWT token
        return this.generateToken(user);
    }
    static generateToken(user) {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined");
        }
        return jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, process.env.JWT_SECRET, { expiresIn: "24h" });
    }
}
exports.AuthService = AuthService;
AuthService.userRepository = database_1.AppDataSource.getRepository(user_model_1.User);
