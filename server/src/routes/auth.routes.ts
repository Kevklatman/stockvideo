// src/routes/auth.routes.ts
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validation.middleware";
import { loginSchema, registerSchema } from "../validation/auth.schema";

const router = Router();

// Registration route
router.post(
  "/register",
  validateRequest(registerSchema),
  AuthController.register
);

// Login route
router.post(
  "/login",
  validateRequest(loginSchema),
  AuthController.login
);

export { router as authRouter };