import { NextFunction, Request, Response } from "express";
import { verifyAccessToken, JwtPayload } from "@/lib/jwt";

export type AuthenticatedUser = JwtPayload & {
  id: number;
  store_id?: number;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  authMethod?: "bearer" | "cookie";
};

export class AuthMiddleware {
  public execute = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    // 1. Try to get token from Authorization Header
    let accessToken = this.extractBearerToken(req.headers.authorization);
    const authMethod = accessToken ? "bearer" : "cookie";

    // 2. Fallback to Cookies (for Web applications)
    if (!accessToken && req.cookies) {
      accessToken = req.cookies.accessToken;
    }

    if (!accessToken) {
      return res.status(401).json({ code: 401, status: "error", message: "Authentication required" });
    }

    // 3. Verify token
    const payload = verifyAccessToken(accessToken);
    if (!payload) {
      return res.status(401).json({ code: 401, status: "error", message: "Invalid or expired token" });
    }

    // 4. Attach user to request
    authReq.user = {
      ...payload,
      id: parseInt(payload.sub, 10),
      store_id: payload.storeId,
    };
    authReq.authMethod = authMethod;
    return next();
  };

  private extractBearerToken(header?: string) {
    if (!header) return undefined;
    const [scheme, token] = header.split(" ");
    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return undefined;
    return token.trim();
  }
}

/**
 * Extracts verified userId and storeId from authenticated request.
 * Returns null if user is unauthenticated or has no valid storeId.
 */
export function getAuthContext(req: Request): { userId: number; storeId: number } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user) return null;

  const userId = user.id || parseInt(user.sub || "0", 10);
  const storeId = user.store_id || user.storeId;

  if (!userId || !storeId || isNaN(userId) || isNaN(storeId) || storeId <= 0) {
    return null;
  }

  return { userId, storeId };
}
