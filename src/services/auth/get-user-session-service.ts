import { UserRepository } from "@/repositories/user-repository";

export async function getUserSessionService(userId: number) {
  const userRepo = new UserRepository();

  try {
    const user = await userRepo.findById(userId);
    if (!user) {
      return { code: 404, status: "error", message: "User not found" };
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      store: user.store
        ? {
            id: user.store.id,
            name: user.store.name,
            code: user.store.code,
            type: user.store.type,
          }
        : null,
    };

    return {
      code: 200,
      status: "success",
      user: userPayload,
      data: {
        user: userPayload,
      },
    };
  } catch (error) {
    console.error("getUserSessionService Error:", error);
    return { code: 500, status: "error", message: "Failed to fetch session" };
  }
}
