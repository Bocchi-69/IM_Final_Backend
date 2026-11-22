import { ShiftRepository } from "@/repositories/shift-repository";

export async function startShiftService(userId: number, storeId: number) {
  const shiftRepo = new ShiftRepository();

  try {
    const shift = await shiftRepo.startShift(userId, storeId);
    const stats = await shiftRepo.getShiftStats(shift.id);

    const shiftPayload = {
      id: shift.id,
      started_at: shift.started_at,
      ended_at: shift.ended_at,
      user: shift.user,
      total: stats.total,
      sales_count: stats.sales_count,
    };

    return {
      code: 200,
      status: "success",
      shift: shiftPayload,
      data: { shift: shiftPayload },
    };
  } catch (error) {
    console.error("startShiftService Error:", error);
    return { code: 500, status: "error", message: "Failed to start shift" };
  }
}
