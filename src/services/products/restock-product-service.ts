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

    // Determine if the old stock was sold out (zero) before this restock
    const wasOutOfStock = existing.stock === 0;

    // Increment stock first
    let updated = await productRepo.incrementStock(productId, storeId, input.quantity);

    // If a new price is provided and the old stock was sold out, update the price now.
    // This applies the new price to the fresh batch of incoming stock.
    if (input.new_price != null && wasOutOfStock) {
      updated = await productRepo.update(productId, storeId, { price: input.new_price }) ?? updated;
    }

    await movementRepo.create({
      storeId,
      productId,
      userId,
      type: "restock",
      quantity: input.quantity,
      note: input.note
        ? input.note
        : input.new_price != null && wasOutOfStock
        ? `Price updated to ${input.new_price} on restock`
        : null,
    });

    return {
      code: 200,
      status: "success",
      message: wasOutOfStock && input.new_price != null
        ? "Product restocked and price updated successfully"
        : "Product restocked successfully",
      data: updated,
    };
  } catch (error) {
    console.error("restockProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to restock product" };
  }
}
