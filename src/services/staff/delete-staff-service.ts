import { UserRepository } from "@/repositories/user-repository";
import { TokenRepository } from "@/repositories/token-repository";
import { ShiftRepository } from "@/repositories/shift-repository";

export async function deleteStaffService(staffId: number, storeId: number) {
  const userRepo = new UserRepository();
  const tokenRepo = new TokenRepository();
  const shiftRepo = new ShiftRepository();

  try {
    const deleted = await userRepo.deleteStaff(staffId, storeId);
    if (!deleted) {
      return { code: 404, status: "error", message: "Staff member not found or cannot be deleted" };
    }

    // Close any active shifts for this staff member
    try {
      const activeShift = await shiftRepo.findActiveShift(staffId, storeId);
      if (activeShift) {
        await shiftRepo.endShift(activeShift.id);
      }
    } catch (shiftErr) {
      console.warn("Could not auto-close shift on staff removal:", shiftErr);
    }

    // Immediately revoke any outstanding refresh tokens
    await tokenRepo.revokeAllByUserId(staffId);

    return {
      code: 204,
      status: "success",
      message: "Staff member deleted successfully",
    };
  } catch (error) {
    console.error("deleteStaffService Error:", error);
    return { code: 500, status: "error", message: "Failed to delete staff member" };
  }
}
