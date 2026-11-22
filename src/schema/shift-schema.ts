import { z } from "zod";

export const shiftListSchema = z.object({
  query: z.object({
    limit: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  }),
});
