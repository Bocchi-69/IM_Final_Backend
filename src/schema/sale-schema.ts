import { z } from "zod";

export const createSaleSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          product_id: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
          quantity: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).refine((q) => q >= 1 && q <= 999, {
            message: "Quantity must be between 1 and 999",
          }),
        })
      )
      .min(1, "At least one item is required in the sale"),
  }),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>["body"];
