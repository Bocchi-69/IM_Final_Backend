import type { Request, Response } from "express";
import { getAuthContext, AuthenticatedRequest } from "@/middlewares/auth-middleware";
import {
  getCurrentShiftService,
  startShiftService,
  endShiftService,
  getShiftsService,
} from "@/services/shifts";

export class ShiftController {
  public current = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const role = (req as AuthenticatedRequest).user?.role || "employee";

    const result = await getCurrentShiftService(auth.userId, auth.storeId, role);
    return res.status(result.code).json({ shift: result.shift });
  };

  public start = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await startShiftService(auth.userId, auth.storeId);
    return res.status(result.code).json({ shift: result.shift });
  };

  public end = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const role = (req as AuthenticatedRequest).user?.role || "employee";

    const result = await endShiftService(auth.userId, auth.storeId, role);
    return res.status(result.code).json(result.shift ? { shift: result.shift } : { message: result.message });
  };

  public index = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

    const result = await getShiftsService(auth.storeId, limit);
    return res.status(result.code).json(result.data);
  };
}
