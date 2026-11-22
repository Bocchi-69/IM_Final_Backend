import { ShiftRepository } from "@/repositories/shift-repository";
import { SaleRepository } from "@/repositories/sale-repository";
import type { CreateSaleInput } from "@/schema/sale-schema";

export async function recordSaleService(
  userId: number,
  storeId: number,
  input: CreateSaleInput
) {
  const shiftRepo = new ShiftRepository();
  const saleRepo = new SaleRepository();

  try {
    const shift = await shiftRepo.findActiveShift(userId, storeId);
    if (!shift) {
      return { code: 422, status: "error", message: "Start a shift before recording sales." };
    }

    const sale = await saleRepo.recordSale(
      userId,
      storeId,
      shift.id,
      input.items,
      input.cash_received !== undefined ? Number(input.cash_received) : undefined
    );

    return {
      code: 201,
      status: "success",
      message: "Sale recorded successfully",
      sale,
      data: { sale },
    };
  } catch (error: any) {
    if (
      error.message?.includes("Only ") ||
      error.message?.includes("Unknown product") ||
      error.message?.includes("Insufficient cash")
    ) {
      return {
        code: 422,
        status: "error",
        message: error.message,
        errors: {
          items: error.message?.includes("Insufficient cash") ? [] : [error.message],
          cash_received: error.message?.includes("Insufficient cash") ? [error.message] : [],
        },
      };
    }
    console.error("recordSaleService Error:", error);
    return { code: 500, status: "error", message: "Failed to record sale" };
  }
}
