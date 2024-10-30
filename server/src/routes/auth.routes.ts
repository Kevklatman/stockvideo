// src/routes/auth.routes.ts
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validation.middleware";
import { loginSchema, registerSchema } from "../validation/auth.schema";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.post(
  "/register",
  validateRequest(registerSchema),
  AuthController.register
);

router.post(
  "/login",
  validateRequest(loginSchema),
  AuthController.login
);

// Protected routes
router.get(
  "/validate",
  authMiddleware,
  AuthController.validateToken
);

export { router as authRouter };