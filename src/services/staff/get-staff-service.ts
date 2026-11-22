import { UserRepository } from "@/repositories/user-repository";

export async function getStaffService(storeId: number) {
  const userRepo = new UserRepository();

  try {
    const staff = await userRepo.findStaffByStoreId(storeId);
    return {
      code: 200,
      status: "success",
      data: staff,
    };
  } catch (error) {
    console.error("getStaffService Error:", error);
    return { code: 500, status: "error", message: "Failed to retrieve staff" };
  }
}
