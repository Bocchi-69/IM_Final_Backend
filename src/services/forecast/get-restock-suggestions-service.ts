import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { sales, saleItems } from "@/db/schema";
import { ProductRepository } from "@/repositories/product-repository";

export async function getRestockSuggestionsService(storeId: number) {
  const productRepo = new ProductRepository();

  try {
    const past28Days = new Date();
    past28Days.setDate(past28Days.getDate() - 28);

    const dailyRows = await db
      .select({
        productId: saleItems.productId,
        perDay: sql<number>`SUM(${saleItems.quantity}) / 28.0`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(eq(sales.storeId, storeId), gte(sales.soldAt, past28Days.toISOString())))
      .groupBy(saleItems.productId);

    const dailyMap = new Map<number, number>();
    for (const r of dailyRows) {
      dailyMap.set(r.productId, parseFloat(String(r.perDay)));
    }

    const allProducts = await productRepo.findAllByStore(storeId);

    const suggestions = allProducts.map((p) => {
      const rate = dailyMap.get(p.id) || 0;
      const daysLeft = rate > 0 ? Math.round((p.stock / rate) * 10) / 10 : null;
      const suggested = Math.ceil(Math.max(0, rate * 14 - p.stock));

      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        stock: p.stock,
        avg_daily: Math.round(rate * 100) / 100,
        days_left: daysLeft,
        suggested_restock: suggested,
      };
    });

    suggestions.sort((a, b) => {
      const valA = a.days_left === null ? 999999 : a.days_left;
      const valB = b.days_left === null ? 999999 : b.days_left;
      return valA - valB;
    });

    return {
      code: 200,
      status: "success",
      data: suggestions,
    };
  } catch (error) {
    console.error("getRestockSuggestionsService Error:", error);
    return { code: 500, status: "error", message: "Failed to generate restock suggestions" };
  }
}
