import { ShiftRepository } from "@/repositories/shift-repository";

export async function startShiftService(userId: number, storeId: number, openingFloat = 500) {
  const shiftRepo = new ShiftRepository();

  try {
    const shift = await shiftRepo.startShift(userId, storeId, openingFloat);
    const stats = await shiftRepo.getShiftStats(shift.id, shift.storeId, shift.started_at);

    const shiftPayload = {
      id: shift.id,
      started_at: shift.started_at,
      ended_at: shift.ended_at,
      opening_float: Number(shift.opening_float ?? openingFloat ?? 500),
      user: shift.user,
      total: stats.total,
      sales_count: stats.sales_count,
      cash_drops_total: stats.cash_drops_total,
      recent_sales: [],
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
