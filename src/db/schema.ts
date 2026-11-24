import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 1. STORES
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("sari-sari").notNull(),
  code: text("code").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

// 2. USERS
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").unique(),
  password: text("password"),
  pin: text("pin"),
  role: text("role").default("employee").notNull(), // 'owner' | 'employee'
  failedPinAttempts: integer("failed_pin_attempts").default(0).notNull(),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true, mode: "string" }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "string" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("user_store_idx").on(table.storeId),
  index("user_email_idx").on(table.email),
  uniqueIndex("users_store_name_uidx")
    .on(table.storeId, sql`lower(trim(${table.name}))`)
    .where(sql`${table.deletedAt} IS NULL`),
]);

// 3. PRODUCTS
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  barcode: text("barcode"),
  emoji: text("emoji"),
  imagePath: text("image_path"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("product_store_sku_uidx")
    .on(table.storeId, sql`lower(${table.sku})`)
    .where(sql`${table.deletedAt} IS NULL`),
  uniqueIndex("product_store_barcode_uidx")
    .on(table.storeId, table.barcode)
    .where(sql`${table.deletedAt} IS NULL`),
]);

// 4. SHIFTS
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  openingFloat: numeric("opening_float", { precision: 12, scale: 2 }).default("500.00").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("shift_user_idx").on(table.userId),
  index("shift_store_idx").on(table.storeId),
  index("shift_started_at_idx").on(table.startedAt),
]);

// 5. SALES
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).default("0").notNull(),
  soldAt: timestamp("sold_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("sales_store_sold_idx").on(table.storeId, table.soldAt),
  index("sales_shift_id_idx").on(table.shiftId),
  index("sales_user_id_idx").on(table.userId),
]);

// 6. SALE ITEMS (Products are soft-deleted; historical sale records are restricted from deletion)
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  productName: text("product_name").notNull(),
  sku: text("sku").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("sale_items_sale_id_idx").on(table.saleId),
  index("sale_items_product_id_idx").on(table.productId),
]);

// 7. STOCK MOVEMENTS (Audit trail restricted from orphaned deletions)
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(), // 'initial' | 'restock' | 'sale'
  quantity: integer("quantity").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("stock_movements_store_idx").on(table.storeId),
  index("stock_movements_product_idx").on(table.productId),
]);

// 8. CASH DROPS
export const cashDrops = pgTable("cash_drops", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  shiftId: integer("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  cashier: text("cashier"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("cash_drops_store_idx").on(table.storeId),
  index("cash_drops_shift_idx").on(table.shiftId),
]);

// 9. STORE EXPENSES
export const storeExpenses = pgTable("store_expenses", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("store_expenses_store_idx").on(table.storeId),
]);

// 10. TOKENS
export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // 'REFRESH' | 'ACCESS'
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "string" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  index("tokens_user_type_idx").on(table.userId, table.type),
]);
