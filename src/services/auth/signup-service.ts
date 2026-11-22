import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { UserRepository } from "@/repositories/user-repository";
import { StoreRepository } from "@/repositories/store-repository";
import { ProductRepository } from "@/repositories/product-repository";
import { TokenRepository } from "@/repositories/token-repository";
import { signAccessToken, signRefreshToken, TokenExpiry } from "@/lib/jwt";
import type { RegisterInput } from "@/schema/auth-schema";

const STARTER_CATALOG = [
  { name: "Lucky Me Pancit Canton (Kalamansi)", sku: "NOOD-001", barcode: "4800016644818", price: 18.0, emoji: "🍜", stock: 30, lowStockThreshold: 10 },
  { name: "Nescafé 3-in-1 Original Sachet", sku: "COF-001", barcode: "4800361280017", price: 12.0, emoji: "☕", stock: 40, lowStockThreshold: 15 },
  { name: "Cooking Oil (350ml Pouch)", sku: "OIL-001", barcode: "4807770270014", price: 35.0, emoji: "🍳", stock: 15, lowStockThreshold: 5 },
  { name: "Coke Sakto (200ml Bottle)", sku: "BEV-001", barcode: "4800049720015", price: 15.0, emoji: "🥤", stock: 50, lowStockThreshold: 12 },
  { name: "Datu Puti Vinegar (350ml)", sku: "CON-001", barcode: "4801123456789", price: 22.0, emoji: "🧂", stock: 20, lowStockThreshold: 8 },
  { name: "Silver Swan Soy Sauce (350ml)", sku: "CON-002", barcode: "4801123456790", price: 20.0, emoji: "🍶", stock: 25, lowStockThreshold: 10 },
];

export async function signupService(input: RegisterInput) {
  const userRepo = new UserRepository();
  const storeRepo = new StoreRepository();
  const productRepo = new ProductRepository();
  const tokenRepo = new TokenRepository();

  try {
    const existing = await userRepo.findByEmail(input.email);
    if (existing) {
      return { code: 422, status: "error", message: "Email has already been taken." };
    }

    // Generate random 6-character store code
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();

    // 1. Create Store
    const store = await storeRepo.create({
      name: input.store_name,
      type: input.type,
      code,
    });

    // 2. Hash password and PIN
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const hashedPin = await bcrypt.hash(input.owner_pin, 10);

    // 3. Create User
    const user = await userRepo.create({
      storeId: store.id,
      name: input.owner_name,
      email: input.email,
      password: hashedPassword,
      pin: hashedPin,
      role: "owner",
    });

    // 4. Seed realistic starter inventory
    for (const prod of STARTER_CATALOG) {
      await productRepo.create({
        storeId: store.id,
        ...prod,
      });
    }

    // 5. Generate Tokens
    const accessToken = signAccessToken(user.id, user.role, store.id, user.name, TokenExpiry.ACCESS_TOKEN_EXPIRES);
    const refreshToken = signRefreshToken(user.id, user.role, store.id, user.name, TokenExpiry.REFRESH_TOKEN_EXPIRES);

    await tokenRepo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      role: user.role,
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
        type: store.type,
      },
    };

    return {
      code: 201,
      status: "success",
      message: "Store registered successfully!",
      user: userPayload,
      token: accessToken,
      data: {
        user: userPayload,
        token: accessToken,
        accessToken,
        refreshToken,
      },
    };
  } catch (error: any) {
    console.error("Signup error:", error);
    return { code: 500, status: "error", message: "Unable to complete store registration" };
  }
}
