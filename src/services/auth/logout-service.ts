import { TokenRepository } from "@/repositories/token-repository";

export async function logoutService(refreshToken?: string) {
  const tokenRepository = new TokenRepository();

  try {
    if (refreshToken) {
      const dbToken = await tokenRepository.findActiveRefreshToken(refreshToken);
      if (dbToken) {
        await tokenRepository.revokeToken(dbToken.id);
      }
    }

    return { code: 204, status: "success", message: "Successfully logged out" };
  } catch (error) {
    console.error("LogoutService Error:", error);
    return { code: 500, status: "error", message: "Failed to logout" };
  }
}
