import { UserRepository } from "@/repositories/user-repository";
import { TokenRepository } from "@/repositories/token-repository";
import { signAccessToken, signRefreshToken, TokenExpiry, verifyRefreshToken } from "@/lib/jwt";

export async function refreshTokenService(refreshToken?: string) {
  const tokenRepository = new TokenRepository();
  const userRepository = new UserRepository();

  try {
    if (!refreshToken) {
      return { code: 400, status: "error", message: "Refresh token is required" };
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return { code: 401, status: "error", message: "Invalid or expired refresh token" };
    }

    const dbToken = await tokenRepository.findActiveRefreshToken(refreshToken);
    if (!dbToken) {
      return { code: 401, status: "error", message: "Token is no longer valid or has been used" };
    }

    const user = await userRepository.findById(parseInt(payload.sub, 10));
    if (!user) {
      return { code: 404, status: "error", message: "User not found" };
    }

    const consumed = await tokenRepository.consumeToken(dbToken.id);
    if (!consumed) {
      return { code: 401, status: "error", message: "Refresh token has already been used" };
    }

    const storeId = user.store?.id || user.storeId || 1;
    const accessToken = signAccessToken(user.id, user.role, storeId, user.name, TokenExpiry.ACCESS_TOKEN_EXPIRES);
    const newRefreshToken = signRefreshToken(user.id, user.role, storeId, user.name, TokenExpiry.REFRESH_TOKEN_EXPIRES);

    await tokenRepoSave(tokenRepository, user.id, newRefreshToken);

    return {
      code: 200,
      status: "success",
      message: "Successfully refreshed token",
      token: accessToken,
      data: { accessToken, refreshToken: newRefreshToken, token: accessToken },
    };
  } catch (error) {
    console.error("RefreshTokenService Error:", error);
    return { code: 500, status: "error", message: "Failed to refresh token" };
  }
}

async function tokenRepoSave(repo: TokenRepository, userId: number, token: string) {
  await repo.createRefreshToken({
    userId,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}
