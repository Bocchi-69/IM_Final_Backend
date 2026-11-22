import { z } from "zod";

export const createCashDropSchema = z.object({
  body: z.object({
    amount: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).refine((a) => a >= 0.01 && a <= 100000, {
      message: "Amount must be between ₱0.01 and ₱100,000",
    }),
    note: z.string().max(255).optional().nullable(),
    cashier: z.string().max(100).optional().nullable(),
  }),
});

export const createExpenseSchema = z.object({
  body: z.object({
    title: z.string({ message: "Expense title is required" }).min(1).max(120),
    amount: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).refine((a) => a >= 0.01 && a <= 100000, {
      message: "Amount must be between ₱0.01 and ₱100,000",
    }),
    note: z.string().max(255).optional().nullable(),
  }),
});

export type CreateCashDropInput = z.infer<typeof createCashDropSchema>["body"];
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
