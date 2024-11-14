"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// src/routes/auth.routes.ts
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_schema_1 = require("../validation/auth.schema");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.authRouter = router;
// Public routes
router.post("/register", (0, validation_middleware_1.validateRequest)(auth_schema_1.registerSchema), auth_controller_1.AuthController.register);
router.post("/login", (0, validation_middleware_1.validateRequest)(auth_schema_1.loginSchema), auth_controller_1.AuthController.login);
// Protected routes
router.get("/validate", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.validateToken);
