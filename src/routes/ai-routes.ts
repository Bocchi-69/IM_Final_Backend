import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { aiRateLimiter } from "@/middlewares/rate-limit-middleware";
import { AiController } from "@/controllers/ai-controller";

const router = Router();
const authMiddleware = new AuthMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const csrfMiddleware = new CsrfMiddleware();
const aiController = new AiController();

router.use(authMiddleware.execute);
router.use(roleValidator.validate("owner"));

// Owner-only AI chat with rate limiting and CSRF protection
router.post("/chat", aiRateLimiter, csrfMiddleware.execute, aiController.chat);

export default router;
