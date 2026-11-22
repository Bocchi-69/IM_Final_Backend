import bcrypt from "bcrypt";
import { UserRepository } from "@/repositories/user-repository";
import { TokenRepository } from "@/repositories/token-repository";
import { signAccessToken, signRefreshToken, TokenExpiry } from "@/lib/jwt";
import type { LoginInput } from "@/schema/auth-schema";

export async function loginService(input: LoginInput) {
  const userRepo = new UserRepository();
  const tokenRepo = new TokenRepository();

  try {
    const user = await userRepo.findByEmail(input.email);
    if (!user || !user.password || !(await bcrypt.compare(input.password, user.password))) {
      return { code: 422, status: "error", message: "Wrong email or password." };
    }

    const store = user.store;
    const storeId = store?.id || user.storeId || 1;

    const accessToken = signAccessToken(user.id, user.role, storeId, user.name, TokenExpiry.ACCESS_TOKEN_EXPIRES);
    const refreshToken = signRefreshToken(user.id, user.role, storeId, user.name, TokenExpiry.REFRESH_TOKEN_EXPIRES);

    await tokenRepo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      role: user.role,
      store: store
        ? {
            id: store.id,
            name: store.name,
            code: store.code,
            type: store.type,
          }
        : null,
    };

    return {
      code: 200,
      status: "success",
      message: "Successfully logged in",
      user: userPayload,
      token: accessToken,
      data: {
        user: userPayload,
        token: accessToken,
        accessToken,
        refreshToken,
      },
    };
  } catch (error) {
    console.error("LoginService Error:", error);
    return { code: 500, status: "error", message: "Failed to login account" };
  }
}
