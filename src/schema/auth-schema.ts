import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    store_name: z.string({ message: "Store name is required" }).min(2, "Store name is too short").max(80),
    type: z.enum(["carenderia", "sari-sari", "sari_sari", "other"]).default("sari-sari"),
    owner_name: z.string({ message: "Owner name is required" }).min(2, "Owner name is too short").max(60),
    email: z.string({ message: "Email is required" }).email("Invalid email address"),
    password: z.string({ message: "Password is required" }).min(8, "Password must be at least 8 characters"),
    owner_pin: z.string({ message: "PIN is required" }).regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string({ message: "Email is required" }).email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const pinLoginSchema = z.object({
  body: z.object({
    store_code: z.string({ message: "Store code is required" }).min(1, "Store code is required"),
    user_id: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
    pin: z.string({ message: "PIN is required" }).regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const storeStaffSchema = z.object({
  params: z.object({
    code: z.string().min(1, "Store code is required"),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type PinLoginInput = z.infer<typeof pinLoginSchema>["body"];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>["body"];
