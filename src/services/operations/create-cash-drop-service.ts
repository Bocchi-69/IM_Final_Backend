import { OperationRepository } from "@/repositories/operation-repository";
import type { CreateCashDropInput } from "@/schema/operation-schema";

export async function createCashDropService(
  storeId: number,
  userId: number,
  userName: string,
  input: CreateCashDropInput
) {
  const opRepo = new OperationRepository();

  try {
    const drop = await opRepo.createCashDrop({
      storeId,
      userId,
      amount: input.amount,
      note: input.note,
      cashier: input.cashier || userName,
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
