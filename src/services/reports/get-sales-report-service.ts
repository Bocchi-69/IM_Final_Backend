import { eq, and, gte, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { sales, saleItems } from "@/db/schema";
import { formatManilaDate, formatManilaMonth, formatManilaYear } from "@/utils/timezone";

export async function getSalesReportService(storeId: number, period: "daily" | "weekly" | "monthly" | "yearly") {
  try {
    const now = new Date();
    let fromDate: Date;
    let formatSql: any;
    let buckets: string[] = [];

    if (period === "daily") {
      fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 13);
      fromDate.setHours(0, 0, 0, 0);

      formatSql = sql<string>`TO_CHAR(${sales.soldAt} AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')`;

      const ptr = new Date(fromDate);
      while (ptr <= now) {
        buckets.push(formatManilaDate(ptr));
        ptr.setDate(ptr.getDate() + 1);
      }
    } else if (period === "weekly") {
      fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 7 * 7);
      fromDate.setHours(0, 0, 0, 0);

      formatSql = sql<string>`TO_CHAR(${sales.soldAt} AT TIME ZONE 'Asia/Manila', 'IYYY-"W"IW')`;

      // Generate week buckets
      const ptr = new Date(fromDate);
      while (ptr <= now) {
        buckets.push(getIsoWeekString(ptr));
        ptr.setDate(ptr.getDate() + 7);
      }
    } else if (period === "monthly") {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      formatSql = sql<string>`TO_CHAR(${sales.soldAt} AT TIME ZONE 'Asia/Manila', 'YYYY-MM')`;

      const ptr = new Date(fromDate);
      while (ptr <= now) {
        buckets.push(formatManilaMonth(ptr));
        ptr.setMonth(ptr.getMonth() + 1);
      }
    } else {
      // yearly
      const currentYear = parseInt(formatManilaYear(now), 10);
      fromDate = new Date(currentYear - 4, 0, 1);

      formatSql = sql<string>`TO_CHAR(${sales.soldAt} AT TIME ZONE 'Asia/Manila', 'YYYY')`;

      for (let y = currentYear - 4; y <= currentYear; y++) {
        buckets.push(String(y));
      }
    }

    buckets = Array.from(new Set(buckets));

    // Aggregate sales by bucket
    const rows = await db
      .select({
        bucket: formatSql,
        total: sql<number>`SUM(${sales.total})`,
        orders: sql<number>`COUNT(${sales.id})`,
      })
      .from(sales)
      .where(and(eq(sales.storeId, storeId), gte(sales.soldAt, fromDate.toISOString())))
      .groupBy(formatSql);

    const bucketMap = new Map<string, { total: number; orders: number }>();
    for (const r of rows) {
      if (r.bucket) {
        bucketMap.set(r.bucket, {
          total: parseFloat(String(r.total)),
          orders: parseInt(String(r.orders), 10),
        });
      }
    }

    const series = buckets.map((b) => {
      const info = bucketMap.get(b) || { total: 0, orders: 0 };
      return {
        bucket: b,
        total: Math.round(info.total * 100) / 100,
        orders: info.orders,
      };
    });

    // Top 5 products
    const topRows = await db
      .select({
        name: saleItems.productName,
        qty: sql<number>`SUM(${saleItems.quantity})`,
        amount: sql<number>`SUM(${saleItems.subtotal})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(eq(sales.storeId, storeId), gte(sales.soldAt, fromDate.toISOString())))
      .groupBy(saleItems.productName)
      .orderBy(desc(sql`SUM(${saleItems.subtotal})`))
      .limit(5);

    const topProducts = topRows.map((r) => ({
      name: r.name,
      qty: parseInt(String(r.qty), 10),
      amount: Math.round(parseFloat(String(r.amount)) * 100) / 100,
    }));

    return {
      code: 200,
      status: "success",
      period,
      series,
      top_products: topProducts,
      data: {
        period,
        series,
        top_products: topProducts,
      },
    };
  } catch (error) {
    console.error("getSalesReportService Error:", error);
    return { code: 500, status: "error", message: "Failed to generate sales report" };
  }
}

function getIsoWeekString(d: Date): string {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
