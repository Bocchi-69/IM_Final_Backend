import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { sales, saleItems, users } from "@/db/schema";
import { ProductRepository } from "@/repositories/product-repository";
import { getForecastService } from "@/services/forecast/get-forecast-service";

export async function getAnalyticsService(storeId: number, daysInput = 30) {
  const days = [7, 30, 90].includes(Number(daysInput)) ? Number(daysInput) : 30;
  const productRepo = new ProductRepository();

  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);

    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);

    // Current period sales
    const currentSales = await fetchSalesWithItems(storeId, start, now);

    // Previous period sales
    const prevSales = await fetchSalesWithItems(storeId, prevStart, prevEnd);

    // --- 1. DESCRIPTIVE ---
    const curRevenue = currentSales.reduce((acc, s) => acc + s.total, 0);
    const prevRevenue = prevSales.reduce((acc, s) => acc + s.total, 0);

    const curOrders = currentSales.length;
    const prevOrders = prevSales.length;

    const curUnits = currentSales.reduce(
      (acc, s) => acc + s.items.reduce((sum, it) => sum + it.quantity, 0),
      0
    );
    const prevUnits = prevSales.reduce(
      (acc, s) => acc + s.items.reduce((sum, it) => sum + it.quantity, 0),
      0
    );

    const curAvgOrder = curOrders > 0 ? curRevenue / curOrders : 0.0;
    const prevAvgOrder = prevOrders > 0 ? prevRevenue / prevOrders : 0.0;

    const calcChange = (cur: number, prev: number): number | null => {
      if (prev === 0) return cur > 0 ? 100.0 : null;
      return Math.round(((cur - prev) / prev) * 1000) / 10;
    };

    const kpis = {
      revenue: {
        value: Math.round(curRevenue * 100) / 100,
        change_pct: calcChange(curRevenue, prevRevenue),
      },
      orders: {
        value: curOrders,
        change_pct: calcChange(curOrders, prevOrders),
      },
      units: {
        value: curUnits,
        change_pct: calcChange(curUnits, prevUnits),
      },
      avg_order: {
        value: Math.round(curAvgOrder * 100) / 100,
        change_pct: calcChange(curAvgOrder, prevAvgOrder),
      },
    };

    // By Weekday (Mon to Sun)
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayTotals: Record<string, { revenue: number; orders: number; count: number }> = {};
    for (const d of weekdayNames) {
      weekdayTotals[d] = { revenue: 0.0, orders: 0, count: 0 };
    }

    const dayPtr = new Date(start);
    while (dayPtr <= now) {
      const name = weekdayNames[dayPtr.getDay()];
      weekdayTotals[name].count++;
      dayPtr.setDate(dayPtr.getDate() + 1);
    }

    for (const s of currentSales) {
      const name = weekdayNames[s.soldAt.getDay()];
      weekdayTotals[name].revenue += s.total;
      weekdayTotals[name].orders++;
    }

    const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const byWeekday = orderedDays.map((d) => {
      const info = weekdayTotals[d];
      const avg = info.count > 0 ? info.revenue / info.count : 0.0;
      return {
        day: d,
        revenue: Math.round(info.revenue * 100) / 100,
        orders: info.orders,
        avg_per_day: Math.round(avg * 100) / 100,
      };
    });

    // By Hour (0..23)
    const hourlyTotals = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      revenue: 0.0,
      orders: 0,
    }));

    for (const s of currentSales) {
      const h = s.soldAt.getHours();
      hourlyTotals[h].revenue += s.total;
      hourlyTotals[h].orders++;
    }

    const byHour = hourlyTotals.map((item) => ({
      hour: item.hour,
      revenue: Math.round(item.revenue * 100) / 100,
      orders: item.orders,
    }));

    // Products breakdown
    const allProducts = await productRepo.findAllByStore(storeId);
    const productStats = new Map<number, {
      id: number;
      name: string;
      emoji: string | null;
      image_url: string | null;
      image_path: string | null;
      qty: number;
      revenue: number;
    }>();

    for (const p of allProducts) {
      productStats.set(p.id, {
        id: p.id,
        name: p.name,
        emoji: p.emoji || "🛍️",
        image_url: p.image_url,
        image_path: p.image_path,
        qty: 0,
        revenue: 0.0,
      });
    }

    for (const s of currentSales) {
      for (const item of s.items) {
        const stat = productStats.get(item.productId);
        if (stat) {
          stat.qty += item.quantity;
          stat.revenue += item.subtotal;
        } else {
          productStats.set(item.productId, {
            id: item.productId,
            name: item.productName,
            emoji: "🛍️",
            image_url: null,
            image_path: null,
            qty: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }

    const productCollection = Array.from(productStats.values()).map((p) => {
      const share = curRevenue > 0 ? Math.round((p.revenue / curRevenue) * 1000) / 10 : 0.0;
      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        image_url: p.image_url,
        image_path: p.image_path,
        qty: p.qty,
        revenue: Math.round(p.revenue * 100) / 100,
        share_pct: share,
      };
    });

    const topProducts = [...productCollection].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const slowProducts = [...productCollection].sort((a, b) => a.qty - b.qty).slice(0, 4);

    // By Employee
    const employeeStats = new Map<string, { name: string; revenue: number; orders: number }>();
    for (const s of currentSales) {
      const empName = s.userName || "Cashier";
      const emp = employeeStats.get(empName) || { name: empName, revenue: 0.0, orders: 0 };
      emp.revenue += s.total;
      emp.orders++;
      employeeStats.set(empName, emp);
    }

    const byEmployee = Array.from(employeeStats.values())
      .map((e) => ({
        name: e.name,
        revenue: Math.round(e.revenue * 100) / 100,
        orders: e.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Market basket frequent pairs
    const pairCounts = new Map<string, number>();
    for (const s of currentSales) {
      const itemNames = Array.from(new Set(s.items.map((it) => it.productName)));
      if (itemNames.length >= 2) {
        for (let i = 0; i < itemNames.length; i++) {
          for (let j = i + 1; j < itemNames.length; j++) {
            const pair = [itemNames[i], itemNames[j]].sort();
            const key = pair.join("|||");
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          }
        }
      }
    }

    const sortedPairs = Array.from(pairCounts.entries()).sort((a, b) => b[1] - a[1]);
    const frequentPairs = sortedPairs.slice(0, 4).map(([key, times]) => {
      const [first, second] = key.split("|||");
      return {
        first,
        second,
        times,
        pct_of_orders: curOrders > 0 ? Math.round((times / curOrders) * 1000) / 10 : 0.0,
      };
    });

    const descriptiveSummary = `In the past ${days} days, the store generated ₱${curRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${curOrders} customer orders (${curOrders > 0 ? `avg ₱${curAvgOrder.toFixed(2)}/order` : "no orders yet"}).`;

    // --- 2. PREDICTIVE ---
    const forecast = await getForecastService(storeId, 14, Math.max(30, days));

    // Demand & Stock-out Risk per product from past 28 days
    const past28Days = new Date();
    past28Days.setDate(past28Days.getDate() - 28);

    const recentSaleItems = await db
      .select({
        productId: saleItems.productId,
        totalQty: sql<number>`SUM(${saleItems.quantity})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(eq(sales.storeId, storeId), gte(sales.soldAt, past28Days.toISOString())))
      .groupBy(saleItems.productId);

    const recentQtyMap = new Map<number, number>();
    for (const r of recentSaleItems) {
      recentQtyMap.set(r.productId, parseFloat(String(r.totalQty)));
    }

    const demandProducts = allProducts.map((p) => {
      const sold28 = recentQtyMap.get(p.id) || 0;
      const avgDaily = Math.round((sold28 / 28) * 100) / 100;
      const daysLeft = avgDaily > 0 ? Math.round((p.stock / avgDaily) * 10) / 10 : null;
      const predicted7d = Math.ceil(avgDaily * 7);

      let risk = "none";
      let stockoutDate: string | null = null;

      if (p.stock <= 0) {
        risk = "high";
        stockoutDate = "Out of Stock";
      } else if (daysLeft !== null) {
        if (daysLeft <= 3) risk = "high";
        else if (daysLeft <= 7) risk = "medium";
        else risk = "low";

        const stockDate = new Date();
        stockDate.setDate(stockDate.getDate() + Math.max(1, Math.round(daysLeft)));
        stockoutDate = stockDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }

      return {
        id: p.id,
        name: p.name,
        emoji: p.emoji || "🛍️",
        image_url: p.image_url,
        image_path: p.image_path,
        stock: p.stock,
        avg_daily: avgDaily,
        days_left: daysLeft,
        predicted_units_7d: predicted7d,
        stockout_date: stockoutDate,
        risk,
      };
    });

    demandProducts.sort((a, b) => {
      const valA = a.days_left === null ? 9999 : a.days_left;
      const valB = b.days_left === null ? 9999 : b.days_left;
      return valA - valB;
    });

    const predictiveSummary = forecast.enough_data
      ? `Forecast projects approximately ₱${(forecast.summary?.next_7_days || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} over the next 7 days with ${forecast.trend?.direction || "steady"} sales trend.${(forecast as any).is_preliminary ? " (Preliminary projection — 14+ days recommended for higher accuracy)." : ""}`
      : "Product inventory analysis based on recent sales pace and demand forecasting.";

    // --- 3. PRESCRIPTIVE ---
    const recommendations = [];

    // Check high risk stockout items
    const highRisk = demandProducts.filter((p) => p.risk === "high");
    for (const hr of highRisk.slice(0, 3)) {
      const needed = Math.max(12, hr.predicted_units_7d * 2);
      recommendations.push({
        type: "inventory",
        priority: "high",
        title: `Restock ${hr.name} immediately`,
        detail: `Current stock is ${hr.stock} units. At ~${hr.avg_daily} units/day, stock is projected to run out around ${hr.stockout_date}.`,
        action: `Order at least ${needed} units to maintain a 14-day supply safety stock.`,
      });
    }

    // Peak hour operations recommendation
    if (byHour.length > 0) {
      const peak = [...byHour].sort((a, b) => b.revenue - a.revenue)[0];
      if (peak && peak.revenue > 0) {
        const peakHourDate = new Date();
        peakHourDate.setHours(peak.hour, 0, 0, 0);
        const peakHourStr = peakHourDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

        recommendations.push({
          type: "staffing",
          priority: "medium",
          title: `Prepare for Peak Hour Rush (${peakHourStr})`,
          detail: `Store records its highest volume around ${peakHourStr} (₱${peak.revenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${peak.orders} sales).`,
          action: `Ensure register drawer has ample small bills & coin change ready before ${peakHourStr}.`,
        });
      }
    }

    // Product bundling recommendation
    if (frequentPairs.length > 0) {
      const topPair = frequentPairs[0];
      recommendations.push({
        type: "merchandising",
        priority: "low",
        title: `Create Combo: ${topPair.first} + ${topPair.second}`,
        detail: `Customers frequently purchase ${topPair.first} and ${topPair.second} together (${topPair.pct_of_orders}% of multi-item carts).`,
        action: `Display these items side-by-side or offer a ₱2 combo discount to incentivize higher cart size.`,
      });
    }

    // Promotion for slowest product
    if (slowProducts.length > 0 && slowProducts[0].qty <= 3) {
      const slow = slowProducts[0];
      recommendations.push({
        type: "promotion",
        priority: "low",
        title: `Clear slow-moving inventory: ${slow.name}`,
        detail: `Only ${slow.qty} units were sold during the past ${days} days.`,
        action: `Apply a promotional price or feature it prominently near the counter to accelerate turnover.`,
      });
    }

    const prescriptiveSummary =
      recommendations.length > 0
        ? `Generated ${recommendations.length} automated recommendations to optimize stock levels and store revenue.`
        : "Store inventory and sales flow are operating optimally.";

    return {
      code: 200,
      status: "success",
      range_days: days,
      descriptive: {
        summary: descriptiveSummary,
        kpis,
        by_weekday: byWeekday,
        by_hour: byHour,
        top_products: topProducts,
        slow_products: slowProducts,
        by_employee: byEmployee,
        frequent_pairs: frequentPairs,
      },
      predictive: {
        summary: predictiveSummary,
        forecast,
        products: demandProducts,
      },
      prescriptive: {
        summary: prescriptiveSummary,
        recommendations,
      },
    };
  } catch (error) {
    console.error("getAnalyticsService Error:", error);
    return { code: 500, status: "error", message: "Failed to generate analytics" };
  }
}

async function fetchSalesWithItems(storeId: number, start: Date, end: Date) {
  const saleRows = await db
    .select({
      id: sales.id,
      total: sales.total,
      soldAt: sales.soldAt,
      userId: sales.userId,
      userName: users.name,
    })
    .from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .where(
      and(
        eq(sales.storeId, storeId),
        gte(sales.soldAt, start.toISOString()),
        lte(sales.soldAt, end.toISOString())
      )
    );

  if (saleRows.length === 0) return [];

  const saleIds = saleRows.map((s) => s.id);
  const itemRows = await db
    .select()
    .from(saleItems)
    .where(sql`${saleItems.saleId} IN ${saleIds}`);

  const itemsMap = new Map<number, any[]>();
  for (const it of itemRows) {
    const list = itemsMap.get(it.saleId) || [];
    list.push({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      subtotal: parseFloat(it.subtotal),
    });
    itemsMap.set(it.saleId, list);
  }

  return saleRows.map((s) => ({
    id: s.id,
    total: parseFloat(s.total),
    soldAt: new Date(s.soldAt),
    userName: s.userName,
    items: itemsMap.get(s.id) || [],
  }));
}
