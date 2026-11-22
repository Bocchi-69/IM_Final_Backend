import { ShiftRepository } from "@/repositories/shift-repository";

export async function getShiftsService(storeId: number, limit = 30) {
  const shiftRepo = new ShiftRepository();

  try {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 50));
    const list = await shiftRepo.listShifts(storeId, safeLimit);

    return {
      code: 200,
      status: "success",
      data: list,
    };
  } catch (error) {
    console.error("getShiftsService Error:", error);
    return { code: 500, status: "error", message: "Failed to retrieve shifts" };
  }
}
