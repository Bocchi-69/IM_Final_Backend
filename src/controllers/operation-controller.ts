import type { Request, Response } from "express";
import { getAuthContext, AuthenticatedRequest } from "@/middlewares/auth-middleware";
import {
  getCashDropsService,
  createCashDropService,
  getExpensesService,
  createExpenseService,
} from "@/services/operations";

export class OperationController {
  public getCashDrops = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await getCashDropsService(auth.storeId);
    return res.status(result.code).json(result.data);
  };

  public storeCashDrop = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const userName = (req as AuthenticatedRequest).user?.name || "Cashier";

    const result = await createCashDropService(auth.storeId, auth.userId, userName, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public getExpenses = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await getExpensesService(auth.storeId);
    return res.status(result.code).json(result.data);
  };

  public storeExpense = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await createExpenseService(auth.storeId, auth.userId, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };
}
