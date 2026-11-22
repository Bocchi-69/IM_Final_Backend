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
