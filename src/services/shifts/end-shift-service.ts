import { ShiftRepository } from "@/repositories/shift-repository";

export async function endShiftService(userId: number, storeId: number, role: string) {
  const shiftRepo = new ShiftRepository();

  try {
    let shift = await shiftRepo.findActiveShift(userId, storeId);

    if (!shift && role.toLowerCase() === "owner") {
      shift = await shiftRepo.findLatestActiveShiftInStore(storeId);
    }

    if (!shift) {
      return { code: 422, status: "error", message: "No active shift found to end." };
    }

    const updated = await shiftRepo.endShift(shift.id);
    const stats = await shiftRepo.getShiftStats(shift.id, shift.storeId, shift.started_at);

    const shiftPayload = {
      id: updated.id,
      started_at: updated.startedAt,
      ended_at: updated.endedAt,
      user: shift.user,
      total: stats.total,
      sales_count: stats.sales_count,
      cash_drops_total: stats.cash_drops_total,
    };

    return {
      code: 200,
      status: "success",
      shift: shiftPayload,
      data: { shift: shiftPayload },
    };
  } catch (error) {
    console.error("endShiftService Error:", error);
    return { code: 500, status: "error", message: "Failed to end shift" };
  }
}
