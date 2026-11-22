import bcrypt from "bcrypt";
import { UserRepository } from "@/repositories/user-repository";
import { StoreRepository } from "@/repositories/store-repository";
import { TokenRepository } from "@/repositories/token-repository";
import { signAccessToken, signRefreshToken, TokenExpiry } from "@/lib/jwt";
import type { PinLoginInput } from "@/schema/auth-schema";

export async function pinLoginService(input: PinLoginInput) {
  const userRepo = new UserRepository();
  const storeRepo = new StoreRepository();
  const tokenRepo = new TokenRepository();

  try {
    const store = await storeRepo.findByCode(input.store_code);
    if (!store) {
      return { code: 404, status: "error", message: "Store code not found." };
    }

    const user = await userRepo.findByIdAndStore(Number(input.user_id), store.id);
    if (!user) {
      return { code: 404, status: "error", message: "Selected staff member does not exist in this store." };
    }

    if (user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date()) {
      return { code: 423, status: "error", message: "PIN locked. Ask the owner to reset it." };
    }

    if (!user.pin || !(await bcrypt.compare(input.pin, user.pin))) {
      const { locked, attempts } = await userRepo.incrementFailedPin(user.id, user.failedPinAttempts);
      const triesLeft = Math.max(0, 3 - attempts);

      if (locked) {
        return {
          code: 423,
          status: "error",
          message: "Too many tries. PIN locked for 15 minutes.",
          tries_left: 0,
        };
      }

      return {
        code: 422,
        status: "error",
        message: `Wrong PIN. ${triesLeft} tries left.`,
        tries_left: triesLeft,
      };
    }

    // PIN is correct, reset attempts
    await userRepo.resetFailedPin(user.id);

    const accessToken = signAccessToken(user.id, user.role, store.id, user.name, TokenExpiry.ACCESS_TOKEN_EXPIRES);
    const refreshToken = signRefreshToken(user.id, user.role, store.id, user.name, TokenExpiry.REFRESH_TOKEN_EXPIRES);

    await tokenRepo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      role: user.role,
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
        type: store.type,
      },
    };

    return {
      code: 200,
      status: "success",
      message: "PIN verified successfully",
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
    console.error("PinLoginService Error:", error);
    return { code: 500, status: "error", message: "Internal server error during PIN login" };
  }
}
