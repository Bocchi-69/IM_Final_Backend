import { eq, and, isNull, desc, inArray, sql, gte, or } from "drizzle-orm";
import { db } from "@/db";
import { shifts, sales, saleItems, users, cashDrops } from "@/db/schema";

export class ShiftRepository {
  async findActiveShift(userId: number, storeId: number) {
    const [shift] = await db
      .select({
        id: shifts.id,
        storeId: shifts.storeId,
        userId: shifts.userId,
        opening_float: shifts.openingFloat,
        started_at: shifts.startedAt,
        ended_at: shifts.endedAt,
        user: {
          id: users.id,
          name: users.name,
        },
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(and(eq(shifts.userId, userId), eq(shifts.storeId, storeId), isNull(shifts.endedAt)))
      .limit(1);

    return shift || null;
  }

  async findLatestActiveShiftInStore(storeId: number) {
    const [shift] = await db
      .select({
        id: shifts.id,
        storeId: shifts.storeId,
        userId: shifts.userId,
        opening_float: shifts.openingFloat,
        started_at: shifts.startedAt,
        ended_at: shifts.endedAt,
        user: {
          id: users.id,
          name: users.name,
        },
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(and(eq(shifts.storeId, storeId), isNull(shifts.endedAt)))
      .orderBy(desc(shifts.startedAt))
      .limit(1);

    return shift || null;
  }

  async getShiftStats(shiftId: number, storeId?: number, shiftStartedAt?: string) {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
        count: sql<number>`COUNT(${sales.id})`,
      })
      .from(sales)
      .where(eq(sales.shiftId, shiftId));

    let cashDropsTotal = 0;
    if (storeId && shiftStartedAt) {
      const [dropsResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${cashDrops.amount}), 0)`,
        })
        .from(cashDrops)
        .where(
          or(
            eq(cashDrops.shiftId, shiftId),
            and(isNull(cashDrops.shiftId), eq(cashDrops.storeId, storeId), gte(cashDrops.createdAt, shiftStartedAt))
          )
        );
      cashDropsTotal = parseFloat(String(dropsResult?.total || 0));
    }

    return {
      total: parseFloat(String(result?.total || 0)),
      sales_count: parseInt(String(result?.count || 0), 10),
      cash_drops_total: cashDropsTotal,
    };
  }

  async getRecentSales(shiftId: number, limit = 10) {
    const recent = await db
      .select()
      .from(sales)
      .where(eq(sales.shiftId, shiftId))
      .orderBy(desc(sales.soldAt))
      .limit(limit);

    if (recent.length === 0) return [];

    const saleIds = recent.map((s) => s.id);
    const items = await db
      .select()
      .from(saleItems)
      .where(inArray(saleItems.saleId, saleIds));

    const itemsBySale = new Map<number, string[]>();
    for (const item of items) {
      const list = itemsBySale.get(item.saleId) || [];
      list.push(`${item.quantity}x ${item.productName}`);
      itemsBySale.set(item.saleId, list);
    }

    return recent.map((s) => ({
      id: s.id,
      time: s.soldAt,
      total: parseFloat(s.total),
      type: "Cash",
      items: (itemsBySale.get(s.id) || []).join(", ") || "POS Sale",
    }));
  }

  async startShift(userId: number, storeId: number, openingFloat: number = 500) {
    const existing = await this.findActiveShift(userId, storeId);
    if (existing) return existing;

    const [created] = await db
      .insert(shifts)
      .values({
        userId,
        storeId,
        openingFloat: String(openingFloat || 500),
        startedAt: new Date().toISOString(),
      })
      .returning();

    const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, userId));

    return {
      id: created.id,
      storeId: created.storeId,
      userId: created.userId,
      opening_float: created.openingFloat,
      started_at: created.startedAt,
      ended_at: created.endedAt,
      user,
    };
  }

  async endShift(shiftId: number) {
    const [updated] = await db
      .update(shifts)
      .set({
        endedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    return updated;
  }

  async listShifts(storeId: number, limit = 30) {
    const shiftRows = await db
      .select({
        id: shifts.id,
        storeId: shifts.storeId,
        userId: shifts.userId,
        started_at: shifts.startedAt,
        ended_at: shifts.endedAt,
        user: {
          id: users.id,
          name: users.name,
        },
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(eq(shifts.storeId, storeId))
      .orderBy(desc(shifts.startedAt))
      .limit(limit);

    if (shiftRows.length === 0) return [];

    const shiftIds = shiftRows.map((s) => s.id);

    // Get aggregated items per shift
    const aggregatedItems = await db
      .select({
        shiftId: sales.shiftId,
        productName: saleItems.productName,
        qty: sql<number>`SUM(${saleItems.quantity})`,
        amount: sql<number>`SUM(${saleItems.subtotal})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(inArray(sales.shiftId, shiftIds))
      .groupBy(sales.shiftId, saleItems.productName)
      .orderBy(desc(sql`SUM(${saleItems.subtotal})`));

    const itemsMap = new Map<number, { product_name: string; qty: number; amount: number }[]>();
    for (const item of aggregatedItems) {
      const list = itemsMap.get(item.shiftId) || [];
      list.push({
        product_name: item.productName,
        qty: parseInt(String(item.qty), 10),
        amount: parseFloat(String(item.amount)),
      });
      itemsMap.set(item.shiftId, list);
    }

    // Get totals and count per shift
    const statsList = await db
      .select({
        shiftId: sales.shiftId,
        total: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
        count: sql<number>`COUNT(${sales.id})`,
      })
      .from(sales)
      .where(inArray(sales.shiftId, shiftIds))
      .groupBy(sales.shiftId);

    const statsMap = new Map<number, { total: number; count: number }>();
    for (const st of statsList) {
      statsMap.set(st.shiftId, {
        total: parseFloat(String(st.total)),
        count: parseInt(String(st.count), 10),
      });
    }

    return shiftRows.map((s) => {
      const st = statsMap.get(s.id) || { total: 0, count: 0 };
      return {
        id: s.id,
        started_at: s.started_at,
        ended_at: s.ended_at,
        user: s.user,
        total: st.total,
        sales_count: st.count,
        items: itemsMap.get(s.id) || [],
      };
    });
  }
}
