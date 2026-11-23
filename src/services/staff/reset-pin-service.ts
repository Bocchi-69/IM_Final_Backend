import bcrypt from "bcrypt";
import { UserRepository } from "@/repositories/user-repository";
import type { ResetStaffPinInput } from "@/schema/staff-schema";

export async function resetPinService(
  staffId: number,
  storeId: number,
  input: ResetStaffPinInput
) {
  const userRepo = new UserRepository();

  try {
    const staff = await userRepo.findByIdAndStore(staffId, storeId);
    if (!staff) {
      return { code: 404, status: "error", message: "Staff member not found" };
    }

    // Check if another user in this store already uses the same PIN
    const existingUsersWithPin = await userRepo.findUsersWithPinByStore(storeId);
    for (const user of existingUsersWithPin) {
      if (user.id !== staffId && user.pin && (await bcrypt.compare(input.pin, user.pin))) {
        return {
          code: 422,
          status: "error",
          message: "This PIN is already in use by another staff member. Please choose a different PIN.",
        };
      }
    }

    const hashedPin = await bcrypt.hash(input.pin, 10);
    const updated = await userRepo.updatePin(staffId, hashedPin);

    return {
      code: 200,
      status: "success",
      message: "PIN reset successfully",
      data: updated,
    };
  } catch (error) {
    console.error("resetPinService Error:", error);
    return { code: 500, status: "error", message: "Failed to reset PIN" };
  }
}
