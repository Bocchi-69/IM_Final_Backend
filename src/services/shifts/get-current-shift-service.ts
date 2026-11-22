import { ShiftRepository } from "@/repositories/shift-repository";

export async function getCurrentShiftService(userId: number, storeId: number, role: string) {
  const shiftRepo = new ShiftRepository();

  try {
    let shift = await shiftRepo.findActiveShift(userId, storeId);

    // If owner has no active shift, look for active store cashier shift
    if (!shift && role.toLowerCase() === "owner") {
      shift = await shiftRepo.findLatestActiveShiftInStore(storeId);
    }

    if (!shift) {
      return {
        code: 200,
        status: "success",
        shift: null,
        data: { shift: null },
      };
    }

    const stats = await shiftRepo.getShiftStats(shift.id);
    const recentSales = await shiftRepo.getRecentSales(shift.id, 10);

    const shiftPayload = {
      id: shift.id,
      started_at: shift.started_at,
      ended_at: shift.ended_at,
      user: shift.user,
      total: stats.total,
      sales_count: stats.sales_count,
      recent_sales: recentSales,
    };

    return {
      code: 200,
      status: "success",
      shift: shiftPayload,
      data: { shift: shiftPayload },
    };
  } catch (error) {
    console.error("getCurrentShiftService Error:", error);
    return { code: 500, status: "error", message: "Failed to retrieve current shift" };
  }
}
