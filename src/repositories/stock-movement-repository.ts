import { db } from "@/db";
import { stockMovements } from "@/db/schema";

export class StockMovementRepository {
  async create(data: {
    storeId: number;
    productId: number;
    userId?: number | null;
    type: string; // 'initial' | 'restock' | 'sale'
    quantity: number;
    note?: string | null;
  }) {
    const [movement] = await db
      .insert(stockMovements)
      .values({
        storeId: data.storeId,
        productId: data.productId,
        userId: data.userId ?? null,
        type: data.type,
        quantity: data.quantity,
        note: data.note ?? null,
      })
      .returning();

    return movement;
  }
}
