import { OperationRepository } from "@/repositories/operation-repository";

export async function getCashDropsService(storeId: number) {
  const opRepo = new OperationRepository();

  try {
    const list = await opRepo.getCashDrops(storeId, 50);
    return {
      code: 200,
      status: "success",
      data: list,
    };
  } catch (error) {
    console.error("getCashDropsService Error:", error);
    return { code: 500, status: "error", message: "Failed to retrieve cash drops" };
  }
}
