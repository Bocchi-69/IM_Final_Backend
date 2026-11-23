import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { OperationController } from "@/controllers/operation-controller";
import {
  createCashDropSchema,
  createExpenseSchema,
} from "@/schema/operation-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const csrfMiddleware = new CsrfMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const opController = new OperationController();

// Explicit per-route guards: only cash-drops and expenses require owner authentication
const ownerGuard = [authMiddleware.execute, roleValidator.validate("owner")];

router.get("/cash-drops", ownerGuard, opController.getCashDrops);
router.post(
  "/cash-drops",
  ownerGuard,
  csrfMiddleware.execute,
  schemaMiddleware.validate(createCashDropSchema),
  opController.storeCashDrop
);

router.get("/expenses", ownerGuard, opController.getExpenses);
router.post(
  "/expenses",
  ownerGuard,
  csrfMiddleware.execute,
  schemaMiddleware.validate(createExpenseSchema),
  opController.storeExpense
);

export default router;
