import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string({ message: "Product name is required" }).min(1).max(60),
    sku: z.string().max(30).optional().nullable(),
    barcode: z.string().max(40).optional().nullable(),
    emoji: z.string().max(8).optional().nullable(),
    image: z.any().optional().nullable(),
    image_path: z.string().optional().nullable(),
    image_url: z.string().optional().nullable(),
    price: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).refine((n) => n >= 0.01, {
      message: "Price must be at least 0.01",
    }),
    stock: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).refine((n) => n >= 0, {
      message: "Stock cannot be negative",
    }),
    low_stock_threshold: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional().nullable(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    name: z.string().min(1).max(60).optional(),
    emoji: z.string().max(8).optional().nullable(),
    image: z.any().optional().nullable(),
    image_path: z.string().optional().nullable(),
    image_url: z.string().optional().nullable(),
    price: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).optional(),
    low_stock_threshold: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  }),
});

export const productIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

export const lookupProductSchema = z.object({
  query: z.object({
    code: z.string().min(1, "Code is required"),
  }),
});

export const restockProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    quantity: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).refine((n) => n >= 1, {
      message: "Quantity must be at least 1",
    }),
    note: z.string().max(120).optional().nullable(),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
export type UpdateProductInput = z.infer<typeof updateProductSchema>["body"];
export type RestockProductInput = z.infer<typeof restockProductSchema>["body"];
