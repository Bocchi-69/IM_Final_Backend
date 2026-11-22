import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { AnalyticsController } from "@/controllers/analytics-controller";
import { analyticsQuerySchema } from "@/schema/report-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const analyticsController = new AnalyticsController();

// Analytics is restricted to store owners
router.get(
  "/",
  authMiddleware.execute,
  roleValidator.validate("owner"),
  schemaMiddleware.validate(analyticsQuerySchema),
  analyticsController.index
);

export default router;
