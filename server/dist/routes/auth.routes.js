"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// server/src/routes/auth.routes.ts
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
exports.authRouter = router;
router.post("/register", auth_controller_1.AuthController.register);
router.post("/login", auth_controller_1.AuthController.login);
