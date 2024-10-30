"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// src/routes/auth.routes.ts
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_schema_1 = require("../validation/auth.schema");
const router = (0, express_1.Router)();
exports.authRouter = router;
// Registration route
router.post("/register", (0, validation_middleware_1.validateRequest)(auth_schema_1.registerSchema), auth_controller_1.AuthController.register);
// Login route
router.post("/login", (0, validation_middleware_1.validateRequest)(auth_schema_1.loginSchema), auth_controller_1.AuthController.login);
