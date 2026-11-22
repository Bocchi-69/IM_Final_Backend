import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { StaffController } from "@/controllers/staff-controller";
import {
  createStaffSchema,
  resetStaffPinSchema,
  staffIdSchema,
} from "@/schema/staff-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const csrfMiddleware = new CsrfMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const staffController = new StaffController();

router.use(authMiddleware.execute);
router.use(roleValidator.validate("owner"));

router.get("/", staffController.index);
router.post("/", csrfMiddleware.execute, schemaMiddleware.validate(createStaffSchema), staffController.store);
router.patch("/:id/pin", csrfMiddleware.execute, schemaMiddleware.validate(resetStaffPinSchema), staffController.resetPin);
router.delete("/:id", csrfMiddleware.execute, schemaMiddleware.validate(staffIdSchema), staffController.destroy);

export default router;
