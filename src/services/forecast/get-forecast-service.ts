import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { formatManilaDate } from "@/utils/timezone";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getForecastService(storeId: number, horizon = 14, historyDays = 120) {
  try {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(start.getDate() - (historyDays - 1));
    start.setHours(0, 0, 0, 0);

    // Fetch daily sales grouped by date in Asia/Manila
    const dailyRows = await db
      .select({
        date: sql<string>`TO_CHAR(${sales.soldAt} AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')`,
        total: sql<number>`SUM(${sales.total})`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          gte(sales.soldAt, start.toISOString()),
          lte(sales.soldAt, end.toISOString())
        )
      )
      .groupBy(sql`TO_CHAR(${sales.soldAt} AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')`);

    const salesByDate = new Map<string, number>();
    for (const r of dailyRows) {
      salesByDate.set(r.date, parseFloat(String(r.total)));
    }

    const dates: Date[] = [];
    const y: number[] = [];

    const pointer = new Date(start);
    while (pointer <= end) {
      const dateStr = formatManilaDate(pointer);
      dates.push(new Date(pointer));
      y.push(salesByDate.get(dateStr) || 0);
      pointer.setDate(pointer.getDate() + 1);
    }

    const firstNonZero = y.findIndex((v) => v > 0);
    if (firstNonZero === -1) {
      return {
        enough_data: false,
        is_preliminary: true,
        message: "No sales recorded yet. Record sales to begin seeing predictive insights.",
      };
    }

    const activeDates = dates.slice(firstNonZero);
    const activeY = y.slice(firstNonZero);
    const n = activeY.length;

    const isPreliminary = n < 14;
    const warning = isPreliminary
      ? "Preliminary Forecast: Predictions are estimated with available sales history. Accumulating 14 or more days of store sales is recommended for optimal accuracy."
      : undefined;

    const model = fitModel(activeDates, activeY);

    const forecast: Array<{ date: string; predicted: number; lower: number; upper: number }> = [];
    const forecastPointer = new Date(end);

    for (let h = 1; h <= horizon; h++) {
      forecastPointer.setDate(forecastPointer.getDate() + 1);
      const predictedVal = Math.max(0, (model.a + model.b * (n - 1 + h)) * model.idx[forecastPointer.getDay()]);
      const p = Math.round(predictedVal * 100) / 100;
      const lower = Math.round(Math.max(0, p - 1.28 * model.sigma) * 100) / 100;
      const upper = Math.round((p + 1.28 * model.sigma) * 100) / 100;

      forecast.push({
        date: formatManilaDate(forecastPointer),
        predicted: p,
        lower,
        upper,
      });
    }

    // Historical holdout validation
    let accuracyPct: number | null = null;
    if (n >= 35) {
      const hold = 14;
      const trainDates = activeDates.slice(0, n - hold);
      const trainY = activeY.slice(0, n - hold);
      const mHold = fitModel(trainDates, trainY);

      let err = 0;
      let act = 0;
      for (let i = n - hold; i < n; i++) {
        const pred = Math.max(0, (mHold.a + mHold.b * i) * mHold.idx[activeDates[i].getDay()]);
        err += Math.abs(activeY[i] - pred);
        act += activeY[i];
      }
      accuracyPct = act > 0 ? Math.round(Math.max(0, 1 - err / act) * 1000) / 10 : null;
    }

    const level = model.a + model.b * (n - 1);
    const weeklyGrowthPct = level > 0 ? (model.b * 7) / level * 100 : 0;
    const bestIdx = model.idx.indexOf(Math.max(...model.idx));
    const slowIdx = model.idx.indexOf(Math.min(...model.idx));

    const history: Array<{ date: string; actual: number }> = [];
    const historyStart = Math.max(0, n - 30);
    for (let i = historyStart; i < n; i++) {
      history.push({
        date: formatLocalDate(activeDates[i]),
        actual: Math.round(activeY[i] * 100) / 100,
      });
    }

    const next7DaysSum = forecast.slice(0, 7).reduce((acc, cur) => acc + cur.predicted, 0);

    return {
      enough_data: true,
      is_preliminary: isPreliminary,
      warning,
      history,
      forecast,
      trend: {
        direction: weeklyGrowthPct > 2 ? "up" : weeklyGrowthPct < -2 ? "down" : "flat",
        weekly_growth_pct: Math.round(weeklyGrowthPct * 10) / 10,
      },
      summary: {
        next_7_days: Math.round(next7DaysSum * 100) / 100,
        best_day: DAYS_FULL[bestIdx],
        slowest_day: DAYS_FULL[slowIdx],
        accuracy_pct: accuracyPct,
      },
      day_of_week: Array.from({ length: 7 }, (_, k) => ({
        day: DAYS_SHORT[k],
        index: Math.round(model.idx[k] * 100) / 100,
      })),
    };
  } catch (error) {
    console.error("getForecastService Error:", error);
    return {
      enough_data: false,
      message: "Unable to generate forecast at this time.",
    };
  }
}

function fitModel(dates: Date[], y: number[]) {
  const n = y.length;
  const mean = y.reduce((a, b) => a + b, 0) / n;

  const sum = new Array(7).fill(0);
  const cnt = new Array(7).fill(0);

  for (let i = 0; i < dates.length; i++) {
    const dow = dates[i].getDay();
    sum[dow] += y[i];
    cnt[dow]++;
  }

  const rawIdx = new Array(7).fill(1);
  for (let k = 0; k < 7; k++) {
    rawIdx[k] = cnt[k] && mean > 0 ? sum[k] / cnt[k] / mean : 1.0;
  }

  const avgIdx = rawIdx.reduce((a, b) => a + b, 0) / 7;
  const idx = rawIdx.map((v) => v / avgIdx);

  const z = y.map((v, i) => v / Math.max(idx[dates[i].getDay()], 0.1));

  const tMean = (n - 1) / 2;
  const zMean = z.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;

  for (let t = 0; t < n; t++) {
    num += (t - tMean) * (z[t] - zMean);
    den += Math.pow(t - tMean, 2);
  }

  const b = den !== 0 ? num / den : 0;
  const a = zMean - b * tMean;

  let ss = 0;
  for (let t = 0; t < n; t++) {
    const pred = (a + b * t) * idx[dates[t].getDay()];
    ss += Math.pow(y[t] - pred, 2);
  }

  const rawSigma = Math.sqrt(ss / Math.max(n - 2, 1));
  const sigma = rawSigma > 0 ? rawSigma : mean * 0.15;

  return { a, b, idx, sigma };
}
