import { Router } from "express";
import authRoutes from "@/routes/auth-routes";
import productRoutes from "@/routes/product-routes";
import shiftRoutes from "@/routes/shift-routes";
import saleRoutes from "@/routes/sale-routes";
import staffRoutes from "@/routes/staff-routes";
import operationRoutes from "@/routes/operation-routes";
import analyticsRoutes from "@/routes/analytics-routes";
import reportRoutes from "@/routes/report-routes";
import aiRoutes from "@/routes/ai-routes";
import { AuthController } from "@/controllers/auth-controller";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { storeStaffSchema } from "@/schema/auth-schema";

const router = Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();
const schemaMiddleware = new SchemaMiddleware();

// 1. Auth routes
router.use("/auth", authRoutes);

// 2. Direct top-level routes matching Laravel API
router.get("/me", authMiddleware.execute, authController.me);
router.get("/stores/:code/staff", schemaMiddleware.validate(storeStaffSchema), authController.staff);

// 3. Products
router.use("/products", productRoutes);

// 4. Shifts
router.use("/shifts", shiftRoutes);

// 5. Sales
router.use("/sales", saleRoutes);

// 6. Staff management (Owner only)
router.use("/staff", staffRoutes);

// 7. Operations (Cash drops & expenses)
router.use("/operations", operationRoutes);
router.use("/", operationRoutes);

// 8. Analytics
router.use("/analytics", analyticsRoutes);

// 9. Reports & Forecasting
router.use("/reports", reportRoutes);

// 10. AI Chatbot (Gemini Copilot)
router.use("/ai", aiRoutes);

export default router;
