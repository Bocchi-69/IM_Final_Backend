import { OperationRepository } from "@/repositories/operation-repository";
import { ShiftRepository } from "@/repositories/shift-repository";
import type { CreateCashDropInput } from "@/schema/operation-schema";

export async function createCashDropService(
  storeId: number,
  userId: number,
  userName: string,
  input: CreateCashDropInput
) {
  const opRepo = new OperationRepository();
  const shiftRepo = new ShiftRepository();

  try {
    const activeShift = await shiftRepo.findLatestActiveShiftInStore(storeId);
    if (!activeShift) {
      return {
        code: 422,
        status: "error",
        message: "Cannot perform cash drop: No active cashier shift currently open in the store register.",
      };
    }

    const stats = await shiftRepo.getShiftStats(activeShift.id, storeId, activeShift.started_at);
    const startingFloat = Number(activeShift.opening_float ?? 500);
    const availableCash = Math.max(0, Math.round((startingFloat + stats.total - stats.cash_drops_total) * 100) / 100);
    const dropAmount = Math.round(Number(input.amount) * 100) / 100;

    if (dropAmount <= 0) {
      return {
        code: 422,
        status: "error",
        message: "Cash drop amount must be greater than zero.",
      };
    }

    if (dropAmount > availableCash) {
      return {
        code: 422,
        status: "error",
        message: `Cannot drop ₱${dropAmount.toFixed(2)}. Requested transfer exceeds available cash in register drawer (₱${availableCash.toFixed(2)}).`,
        errors: { amount: [`Exceeds available drawer cash of ₱${availableCash.toFixed(2)}`] },
      };
    }

    const drop = await opRepo.createCashDrop({
      storeId,
      shiftId: activeShift.id,
      userId,
      amount: dropAmount,
      note: input.note,
      cashier: input.cashier || activeShift.user?.name || userName,
    });

    return {
      code: 201,
      status: "success",
      message: "Cash drop created successfully",
      data: drop,
    };
  } catch (error) {
    console.error("createCashDropService Error:", error);
    return { code: 500, status: "error", message: "Failed to record cash drop" };
  }
}
