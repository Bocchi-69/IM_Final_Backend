import { ProductRepository } from "@/repositories/product-repository";
import { StockMovementRepository } from "@/repositories/stock-movement-repository";
import type { RestockProductInput } from "@/schema/product-schema";

export async function restockProductService(
  productId: number,
  storeId: number,
  userId: number,
  input: RestockProductInput
) {
  const productRepo = new ProductRepository();
  const movementRepo = new StockMovementRepository();

  try {
    const existing = await productRepo.findById(productId, storeId);
    if (!existing) {
      return { code: 404, status: "error", message: "Product not found" };
    }

    const updated = await productRepo.incrementStock(productId, storeId, input.quantity);

    await movementRepo.create({
      storeId,
      productId,
      userId,
      type: "restock",
      quantity: input.quantity,
      note: input.note || null,
    });

    return {
      code: 200,
      status: "success",
      message: "Product restocked successfully",
      data: updated,
    };
  } catch (error) {
    console.error("restockProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to restock product" };
  }
}
