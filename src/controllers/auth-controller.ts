import { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/middlewares/auth-middleware";
import {
  getCsrfTokenService,
  signupService,
  loginService,
  pinLoginService,
  getUserSessionService,
  getStoreStaffService,
  logoutService,
  refreshTokenService,
} from "@/services/auth";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth-cookies";

export class AuthController {
  public getCsrfToken = (req: Request, res: Response) => {
    const result = getCsrfTokenService(req, res);
    return res.status(result.code).json(result);
  };

  public signup = async (req: Request, res: Response) => {
    const result = await signupService(req.body);

    if (result.code === 201 && result.data?.accessToken && result.data?.refreshToken) {
      setAuthCookies(res, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      });
    }

    return res.status(result.code).json(result.user ? { user: result.user, token: result.token } : result);
  };

  public login = async (req: Request, res: Response) => {
    const result = await loginService(req.body);

    if (result.code === 200 && result.data?.accessToken && result.data?.refreshToken) {
      setAuthCookies(res, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      });
    }

    return res.status(result.code).json(result.user ? { user: result.user, token: result.token } : result);
  };

  public pinLogin = async (req: Request, res: Response) => {
    const result = await pinLoginService(req.body);

    if (result.code === 200 && result.data?.accessToken && result.data?.refreshToken) {
      setAuthCookies(res, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      });
    }

    return res.status(result.code).json(result.user ? { user: result.user, token: result.token } : result);
  };

  public staff = async (req: Request, res: Response) => {
    const result = await getStoreStaffService(req.params.code as string);
    return res.status(result.code).json(result.store ? { store: result.store, staff: result.staff } : result);
  };

  public me = async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || parseInt(authReq.user?.sub || "0", 10);
    const result = await getUserSessionService(userId);
    return res.status(result.code).json(result.user ? { user: result.user } : result);
  };

  public logout = async (req: Request, res: Response) => {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const result = await logoutService(refreshToken);
    clearAuthCookies(res);
    return res.status(result.code).send();
  };

  public refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const result = await refreshTokenService(refreshToken);

    if (result.code === 200 && result.data?.accessToken && result.data?.refreshToken) {
      setAuthCookies(res, {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
      });
    }

    return res.status(result.code).json(result);
  };
}
