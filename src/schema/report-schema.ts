import { z } from "zod";

export const salesReportSchema = z.object({
  query: z.object({
    period: z.enum(["daily", "weekly", "monthly", "yearly"], {
      message: "Period must be one of: daily, weekly, monthly, yearly",
    }),
  }),
});

export const forecastReportSchema = z.object({
  query: z.object({
    horizon: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  }),
});

export const analyticsQuerySchema = z.object({
  query: z.object({
    days: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  }),
});
