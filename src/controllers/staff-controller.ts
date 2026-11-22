import type { Request, Response } from "express";
import { getAuthContext } from "@/middlewares/auth-middleware";
import {
  getStaffService,
  createStaffService,
  resetPinService,
  deleteStaffService,
} from "@/services/staff";

export class StaffController {
  public index = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await getStaffService(auth.storeId);
    return res.status(result.code).json(result.data);
  };

  public store = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await createStaffService(auth.storeId, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public resetPin = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const staffId = parseInt(req.params.id as string, 10);

    const result = await resetPinService(staffId, auth.storeId, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public destroy = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const staffId = parseInt(req.params.id as string, 10);

    const result = await deleteStaffService(staffId, auth.storeId);
    return res.status(result.code).send();
  };
}
