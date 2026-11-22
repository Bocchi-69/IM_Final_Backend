import type { Request, Response } from "express";
import { getAuthContext } from "@/middlewares/auth-middleware";
import { getAnalyticsService } from "@/services/analytics";

export class AnalyticsController {
  public index = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    const result = await getAnalyticsService(auth.storeId, days);
    return res.status(result.code).json(result);
  };
}
