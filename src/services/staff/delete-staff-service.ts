import { UserRepository } from "@/repositories/user-repository";

export async function deleteStaffService(staffId: number, storeId: number) {
  const userRepo = new UserRepository();

  try {
    const deleted = await userRepo.deleteStaff(staffId, storeId);
    if (!deleted) {
      return { code: 404, status: "error", message: "Staff member not found or cannot be deleted" };
    }

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
