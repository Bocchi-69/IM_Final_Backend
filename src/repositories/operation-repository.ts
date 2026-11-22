import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { cashDrops, storeExpenses } from "@/db/schema";

export class OperationRepository {
  async getCashDrops(storeId: number, limit = 50) {
    const rows = await db
      .select()
      .from(cashDrops)
      .where(eq(cashDrops.storeId, storeId))
      .orderBy(desc(cashDrops.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      store_id: r.storeId,
      user_id: r.userId,
      amount: parseFloat(r.amount),
      note: r.note,
      cashier: r.cashier,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  async createCashDrop(data: {
    storeId: number;
    userId: number;
    amount: number | string;
    note?: string | null;
    cashier?: string | null;
  }) {
    const [row] = await db
      .insert(cashDrops)
      .values({
        storeId: data.storeId,
        userId: data.userId,
        amount: String(data.amount),
        note: data.note ?? null,
        cashier: data.cashier ?? null,
      })
      .returning();

    return {
      id: row.id,
      store_id: row.storeId,
      user_id: row.userId,
      amount: parseFloat(row.amount),
      note: row.note,
      cashier: row.cashier,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  async getExpenses(storeId: number, limit = 50) {
    const rows = await db
      .select()
      .from(storeExpenses)
      .where(eq(storeExpenses.storeId, storeId))
      .orderBy(desc(storeExpenses.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      store_id: r.storeId,
      user_id: r.userId,
      title: r.title,
      amount: parseFloat(r.amount),
      note: r.note,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
  }

  async createExpense(data: {
    storeId: number;
    userId: number;
    title: string;
    amount: number | string;
    note?: string | null;
  }) {
    const [row] = await db
      .insert(storeExpenses)
      .values({
        storeId: data.storeId,
        userId: data.userId,
        title: data.title,
        amount: String(data.amount),
        note: data.note ?? null,
      })
      .returning();

    return {
      id: row.id,
      store_id: row.storeId,
      user_id: row.userId,
      title: row.title,
      amount: parseFloat(row.amount),
      note: row.note,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
