import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productBatches, products, stockMovements } from "@/db/schema";
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

    // Determine the price for this new batch
    const batchPrice = input.new_price != null ? Number(input.new_price) : existing.price;

    return await db.transaction(async (tx) => {
      // 1. Fetch active batches for this product
      const activeBatches = await tx
        .select()
        .from(productBatches)
        .where(
          and(
            eq(productBatches.productId, productId),
            eq(productBatches.storeId, storeId),
            eq(productBatches.status, "active"),
            sql`${productBatches.quantity} > 0`
          )
        )
        .orderBy(asc(productBatches.id))
        .for("update");

      // If existing product has stock > 0 but no batches in table (legacy product), create initial batch
      if (existing.stock > 0 && activeBatches.length === 0) {
        await tx.insert(productBatches).values({
          storeId,
          productId,
          quantity: existing.stock,
          initialQuantity: existing.stock,
          price: String(existing.price),
          status: "active",
        });
      }

      // 2. Insert the new restock batch
      await tx.insert(productBatches).values({
        storeId,
        productId,
        quantity: input.quantity,
        initialQuantity: input.quantity,
        price: String(batchPrice),
        status: "active",
      });

      // 3. Increment stock on product table
      // If product was completely out of stock (stock === 0), update product price immediately!
      const updateData: Record<string, any> = {
        stock: sql`${products.stock} + ${input.quantity}`,
        updatedAt: new Date().toISOString(),
      };
      if (existing.stock === 0) {
        updateData.price = String(batchPrice);
      }

      const [updatedRow] = await tx
        .update(products)
        .set(updateData)
        .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
        .returning();

      // 4. Log stock movement
      await tx.insert(stockMovements).values({
        storeId,
        productId,
        userId,
        type: "restock",
        quantity: input.quantity,
        note: input.note
          ? input.note
          : input.new_price != null
          ? existing.stock === 0
            ? `Restocked ${input.quantity} units @ ₱${batchPrice.toFixed(2)} (Active immediately)`
            : `Restocked ${input.quantity} units @ ₱${batchPrice.toFixed(2)} (Queued after current ${existing.stock} units)`
          : `Restocked ${input.quantity} units`,
      });

      // Refetch batches for formatted entity
      const allActiveBatches = await tx
        .select()
        .from(productBatches)
        .where(
          and(
            eq(productBatches.productId, productId),
            eq(productBatches.storeId, storeId),
            eq(productBatches.status, "active"),
            sql`${productBatches.quantity} > 0`
          )
        )
        .orderBy(asc(productBatches.id));

      const formattedBatches = allActiveBatches.map((b) => ({
        id: b.id,
        product_id: b.productId,
        quantity: b.quantity,
        initial_quantity: b.initialQuantity,
        price: parseFloat(b.price),
        status: b.status,
        created_at: b.createdAt,
      }));

      const updated = productRepo.formatProduct(updatedRow, formattedBatches);

      let message = `Product restocked successfully (+${input.quantity} units).`;
      if (input.new_price != null) {
        if (existing.stock === 0) {
          message = `Product restocked with ${input.quantity} units. Selling price set to ₱${batchPrice.toFixed(2)}.`;
        } else {
          message = `Added ${input.quantity} units queued at ₱${batchPrice.toFixed(2)}. This price will automatically activate once earlier batches sell out.`;
        }
      }

      return {
        code: 200,
        status: "success",
        message,
        data: updated,
      };
    });
  } catch (error) {
    console.error("restockProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to restock product" };
  }
}
