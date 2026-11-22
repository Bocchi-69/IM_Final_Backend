import type { Request, Response } from "express";
import { getAuthContext } from "@/middlewares/auth-middleware";
import { getForecastService, getRestockSuggestionsService } from "@/services/forecast";

export class ForecastController {
  public forecast = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const horizon = req.query.horizon ? parseInt(req.query.horizon as string, 10) : 14;

    const result = await getForecastService(auth.storeId, horizon);
    return res.status(200).json(result);
  };

  public restock = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await getRestockSuggestionsService(auth.storeId);
    return res.status(result.code).json(result.data);
  };
}
