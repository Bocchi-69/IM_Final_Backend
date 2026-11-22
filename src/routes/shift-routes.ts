import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { ShiftController } from "@/controllers/shift-controller";
import { shiftListSchema } from "@/schema/shift-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const csrfMiddleware = new CsrfMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const shiftController = new ShiftController();

// Cashier & Owner: Current shift status and starting/ending active shifts
router.get("/current", authMiddleware.execute, shiftController.current);
router.post("/start", authMiddleware.execute, csrfMiddleware.execute, shiftController.start);
router.post("/end", authMiddleware.execute, csrfMiddleware.execute, shiftController.end);

// Owner only: View full shifts list, history, and cashier shift logs
router.get(
  "/",
  authMiddleware.execute,
  roleValidator.validate("owner"),
  schemaMiddleware.validate(shiftListSchema),
  shiftController.index
);

export default router;
