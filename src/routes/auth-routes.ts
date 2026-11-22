import { Router } from "express";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { authRateLimiter, registerRateLimiter } from "@/middlewares/rate-limit-middleware";
import { AuthController } from "@/controllers/auth-controller";
import {
  registerSchema,
  loginSchema,
  pinLoginSchema,
  refreshTokenSchema,
} from "@/schema/auth-schema";

const router = Router();
const schemaMiddleware = new SchemaMiddleware();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();
const csrfMiddleware = new CsrfMiddleware();

// CSRF Token
router.get("/csrf-token", authController.getCsrfToken);
router.get("/v1/csrf-token", authController.getCsrfToken);

// Registration Routes (Protected by rate limiting & validation)
router.post(
  "/register",
  registerRateLimiter,
  csrfMiddleware.auth,
  schemaMiddleware.validate(registerSchema),
  authController.signup
);
router.post(
  "/v1/signup",
  registerRateLimiter,
  csrfMiddleware.auth,
  schemaMiddleware.validate(registerSchema),
  authController.signup
);

// Login Routes (Protected by auth rate limiter against brute force)
router.post(
  "/login",
  authRateLimiter,
  csrfMiddleware.auth,
  schemaMiddleware.validate(loginSchema),
  authController.login
);
router.post(
  "/v1/login",
  authRateLimiter,
  csrfMiddleware.auth,
  schemaMiddleware.validate(loginSchema),
  authController.login
);

// PIN Login Route (Protected by rate limiting & per-user lockout)
router.post(
  "/pin-login",
  authRateLimiter,
  csrfMiddleware.auth,
  schemaMiddleware.validate(pinLoginSchema),
  authController.pinLogin
);

// Token Refresh Routes
router.post(
  "/refresh-token",
  csrfMiddleware.refreshToken,
  schemaMiddleware.validate(refreshTokenSchema),
  authController.refreshToken
);
router.post(
  "/v1/refresh-token",
  csrfMiddleware.refreshToken,
  schemaMiddleware.validate(refreshTokenSchema),
  authController.refreshToken
);

// Logout Routes
router.post("/logout", authMiddleware.execute, authController.logout);
router.post("/v1/logout", authMiddleware.execute, authController.logout);

export default router;
