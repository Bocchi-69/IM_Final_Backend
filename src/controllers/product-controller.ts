import type { Request, Response } from "express";
import { getAuthContext } from "@/middlewares/auth-middleware";
import {
  getProductsService,
  lookupProductService,
  createProductService,
  updateProductService,
  deleteProductService,
  restockProductService,
  suggestProductCodesService,
} from "@/services/products";

export class ProductController {
  public suggestCodes = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const name = req.query.name as string | undefined;

    const result = await suggestProductCodesService(auth.storeId, name);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public index = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const q = req.query.q as string | undefined;

    const result = await getProductsService(auth.storeId, q);
    return res.status(result.code).json(result.data);
  };

  public lookup = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const code = req.query.code as string;

    const result = await lookupProductService(auth.storeId, code);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public store = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }

    const result = await createProductService(auth.storeId, auth.userId, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public update = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const productId = parseInt(req.params.id as string, 10);

    const result = await updateProductService(productId, auth.storeId, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };

  public destroy = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const productId = parseInt(req.params.id as string, 10);

    const result = await deleteProductService(productId, auth.storeId);
    return res.status(result.code).send();
  };

  public restock = async (req: Request, res: Response) => {
    const auth = getAuthContext(req);
    if (!auth) {
      return res.status(403).json({ code: 403, status: "error", message: "Forbidden: No store assigned to this account" });
    }
    const productId = parseInt(req.params.id as string, 10);

    const result = await restockProductService(productId, auth.storeId, auth.userId, req.body);
    return res.status(result.code).json(result.data || { message: result.message });
  };
}
