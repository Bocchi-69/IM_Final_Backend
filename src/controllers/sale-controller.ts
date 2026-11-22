import type { Request, Response } from "express";
import { getAuthContext } from "@/middlewares/auth-middleware";
import { recordSaleService } from "@/services/sales";

export class SaleController {
  public store = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await recordSaleService(auth.userId, auth.storeId, req.body);
    return res.status(result.code).json(result.sale ? { sale: result.sale } : { message: result.message, errors: (result as any).errors });
  };
}
