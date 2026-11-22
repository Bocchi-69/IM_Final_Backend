import { OperationRepository } from "@/repositories/operation-repository";
import type { CreateExpenseInput } from "@/schema/operation-schema";

export async function createExpenseService(
  storeId: number,
  userId: number,
  input: CreateExpenseInput
) {
  const opRepo = new OperationRepository();

  try {
    const expense = await opRepo.createExpense({
      storeId,
      userId,
      title: input.title,
      amount: input.amount,
      note: input.note,
    });

    return {
      code: 201,
      status: "success",
      message: "Expense recorded successfully",
      data: expense,
    };
  } catch (error) {
    console.error("createExpenseService Error:", error);
    return { code: 500, status: "error", message: "Failed to record expense" };
  }
}
