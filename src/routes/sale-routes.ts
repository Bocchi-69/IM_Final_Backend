import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { CsrfMiddleware } from "@/middlewares/csrf-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { SaleController } from "@/controllers/sale-controller";
import { createSaleSchema } from "@/schema/sale-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const csrfMiddleware = new CsrfMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const saleController = new SaleController();

router.post("/", authMiddleware.execute, csrfMiddleware.execute, schemaMiddleware.validate(createSaleSchema), saleController.store);

export default router;
