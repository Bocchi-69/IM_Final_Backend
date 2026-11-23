import { NextFunction, Request, Response } from "express";
import { verifyAccessToken, JwtPayload } from "@/lib/jwt";
import { UserRepository } from "@/repositories/user-repository";

export type AuthenticatedUser = JwtPayload & {
  id: number;
  store_id?: number;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  authMethod?: "bearer" | "cookie";
};

export class AuthMiddleware {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

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

    const userId = parseInt(payload.sub, 10);
    if (!userId || isNaN(userId)) {
      return res.status(401).json({ code: 401, status: "error", message: "Invalid token subject" });
    }

    // 4. Verify user still exists in DB (revokes access immediately on staff deletion)
    const user = await this.userRepo.findById(userId);
    if (!user || user.storeId !== payload.storeId) {
      return res.status(401).json({
        code: 401,
        status: "error",
        message: "User account no longer exists or access was revoked",
      });
    }

    // 5. Attach user to request
    authReq.user = {
      ...payload,
      id: userId,
      role: user.role as any,
      store_id: user.storeId,
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
