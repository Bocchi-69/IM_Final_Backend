import { z } from "zod";

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string({ message: "Staff name is required" }).min(2, "Name is too short").max(60),
    pin: z.string({ message: "PIN is required" }).regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
});

export const resetStaffPinSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    pin: z.string({ message: "PIN is required" }).regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
});

export const staffIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>["body"];
export type ResetStaffPinInput = z.infer<typeof resetStaffPinSchema>["body"];
