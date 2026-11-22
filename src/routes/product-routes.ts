import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { ProductController } from "@/controllers/product-controller";
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  lookupProductSchema,
  restockProductSchema,
} from "@/schema/product-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const csrfMiddleware = new CsrfMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const productController = new ProductController();

// GET all products / search
router.get("/", authMiddleware.execute, productController.index);

// GET lookup by barcode or SKU
router.get("/lookup", authMiddleware.execute, schemaMiddleware.validate(lookupProductSchema), productController.lookup);

// GET automatic SKU & barcode suggestions for new product
router.get("/suggest-codes", authMiddleware.execute, productController.suggestCodes);

// Owner operations
router.post(
  "/",
  authMiddleware.execute,
  roleValidator.validate("owner"),
  csrfMiddleware.execute,
  schemaMiddleware.validate(createProductSchema),
  productController.store
);

router.put(
  "/:id",
  authMiddleware.execute,
  roleValidator.validate("owner"),
  csrfMiddleware.execute,
  schemaMiddleware.validate(updateProductSchema),
  productController.update
);

router.delete(
  "/:id",
  authMiddleware.execute,
  roleValidator.validate("owner"),
  csrfMiddleware.execute,
  schemaMiddleware.validate(productIdSchema),
  productController.destroy
);

router.post(
  "/:id/restock",
  authMiddleware.execute,
  roleValidator.validate("owner"),
  csrfMiddleware.execute,
  schemaMiddleware.validate(restockProductSchema),
  productController.restock
);

export default router;
