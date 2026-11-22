import type { Request, Response } from "express";
import { getAuthContext } from "@/middlewares/auth-middleware";
import { getSalesReportService } from "@/services/reports";

export class ReportController {
  public sales = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const period = (req.query.period as any) || "daily";

    const result = await getSalesReportService(auth.storeId, period);
    return res.status(result.code).json(result.series ? { period: result.period, series: result.series, top_products: result.top_products } : result);
  };
}
