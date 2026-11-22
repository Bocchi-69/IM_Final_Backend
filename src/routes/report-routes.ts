import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth-middleware";
import { RoleValidatorMiddleware } from "@/middlewares/role-validator-middleware";
import { SchemaMiddleware } from "@/middlewares/schema-middleware";
import { ReportController } from "@/controllers/report-controller";
import { ForecastController } from "@/controllers/forecast-controller";
import { salesReportSchema, forecastReportSchema } from "@/schema/report-schema";

const router = Router();
const authMiddleware = new AuthMiddleware();
const roleValidator = new RoleValidatorMiddleware();
const schemaMiddleware = new SchemaMiddleware();
const reportController = new ReportController();
const forecastController = new ForecastController();

// Financial reports and AI forecasts are restricted to store owners
router.use(authMiddleware.execute);
router.use(roleValidator.validate("owner"));

router.get("/sales", schemaMiddleware.validate(salesReportSchema), reportController.sales);
router.get("/forecast", schemaMiddleware.validate(forecastReportSchema), forecastController.forecast);
router.get("/restock-suggestions", forecastController.restock);

export default router;
