import { eq, and, or, ilike, sql, isNull, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, productBatches } from "@/db/schema";
import { ENV } from "@/config/env";

export type BatchEntity = {
  id: number;
  product_id: number;
  quantity: number;
  initial_quantity: number;
  price: number;
  status: string;
  created_at: string;
};

export type ProductEntity = {
  id: number;
  store_id?: number;
  name: string;
  sku: string;
  barcode: string | null;
  emoji: string | null;
  image_path: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  low_stock_threshold: number;
  batches?: BatchEntity[];
  created_at?: string;
  updated_at?: string;
};

export class ProductRepository {
  public formatProduct(
    p: typeof products.$inferSelect,
    batches?: BatchEntity[]
  ): ProductEntity {
    let imageUrl: string | null = null;
    if (p.imagePath) {
      if (p.imagePath.startsWith("http://") || p.imagePath.startsWith("https://") || p.imagePath.startsWith("data:")) {
        imageUrl = p.imagePath;
      } else {
        const clean = p.imagePath.replace(/^\/?(storage\/)?/, "");
        const baseUrl = ENV.BACKEND_URL.replace(/\/api\/?$/, "");
        imageUrl = `${baseUrl}/storage/${clean}`;
      }
    }

    return {
      id: p.id,
      store_id: p.storeId,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      emoji: p.emoji,
      image_path: p.imagePath,
      image_url: imageUrl,
      price: parseFloat(p.price),
      stock: p.stock,
      low_stock_threshold: p.lowStockThreshold,
      batches: batches || [],
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  }

  async findAllByStore(storeId: number, query?: string): Promise<ProductEntity[]> {
    let condition = and(eq(products.storeId, storeId), isNull(products.deletedAt));

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      condition = and(
        condition,
        or(
          ilike(products.name, q),
          ilike(products.sku, q),
          eq(products.barcode, query.trim())
        )
      );
    }

    const rows = await db
      .select()
      .from(products)
      .where(condition)
      .orderBy(asc(products.name));

    if (rows.length === 0) return [];

    const productIds = rows.map((r) => r.id);
    const batchRows = await db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.storeId, storeId),
          inArray(productBatches.productId, productIds),
          eq(productBatches.status, "active"),
          sql`${productBatches.quantity} > 0`
        )
      )
      .orderBy(asc(productBatches.id));

    const batchesByProduct = new Map<number, BatchEntity[]>();
    for (const b of batchRows) {
      const list = batchesByProduct.get(b.productId) || [];
      list.push({
        id: b.id,
        product_id: b.productId,
        quantity: b.quantity,
        initial_quantity: b.initialQuantity,
        price: parseFloat(b.price),
        status: b.status,
        created_at: b.createdAt,
      });
      batchesByProduct.set(b.productId, list);
    }

    return rows.map((r) => this.formatProduct(r, batchesByProduct.get(r.id) || []));
  }

  async findById(id: number, storeId: number): Promise<ProductEntity | null> {
    const [row] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt)))
      .limit(1);

    if (!row) return null;

    const batchRows = await db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.storeId, storeId),
          eq(productBatches.productId, id),
          eq(productBatches.status, "active"),
          sql`${productBatches.quantity} > 0`
        )
      )
      .orderBy(asc(productBatches.id));

    const batches: BatchEntity[] = batchRows.map((b) => ({
      id: b.id,
      product_id: b.productId,
      quantity: b.quantity,
      initial_quantity: b.initialQuantity,
      price: parseFloat(b.price),
      status: b.status,
      created_at: b.createdAt,
    }));

    return this.formatProduct(row, batches);
  }

  async lookup(storeId: number, code: string): Promise<ProductEntity | null> {
    const trimmed = code.trim();
    const [row] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          isNull(products.deletedAt),
          or(
            eq(products.barcode, trimmed),
            sql`LOWER(${products.sku}) = LOWER(${trimmed})`
          )
        )
      )
      .limit(1);

    return row ? this.formatProduct(row) : null;
  }

  async checkSkuExists(storeId: number, sku: string, excludeId?: number): Promise<boolean> {
    const condition = excludeId
      ? and(
          eq(products.storeId, storeId),
          sql`LOWER(${products.sku}) = LOWER(${sku})`,
          isNull(products.deletedAt),
          sql`${products.id} != ${excludeId}`
        )
      : and(
          eq(products.storeId, storeId),
          sql`LOWER(${products.sku}) = LOWER(${sku})`,
          isNull(products.deletedAt)
        );

    const [row] = await db.select({ id: products.id }).from(products).where(condition).limit(1);
    return Boolean(row);
  }

  async checkBarcodeExists(storeId: number, barcode: string, excludeId?: number): Promise<boolean> {
    const condition = excludeId
      ? and(
          eq(products.storeId, storeId),
          eq(products.barcode, barcode),
          isNull(products.deletedAt),
          sql`${products.id} != ${excludeId}`
        )
      : and(
          eq(products.storeId, storeId),
          eq(products.barcode, barcode),
          isNull(products.deletedAt)
        );

    const [row] = await db.select({ id: products.id }).from(products).where(condition).limit(1);
    return Boolean(row);
  }

  async getStoreProductCount(storeId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.storeId, storeId));
    return Number(result?.count || 0);
  }

  async getMaxId(): Promise<number> {
    const [result] = await db.select({ max: sql<number>`COALESCE(MAX(${products.id}), 0)` }).from(products);
    return Number(result?.max || 0);
  }

  async create(data: {
    storeId: number;
    name: string;
    sku: string;
    barcode?: string | null;
    emoji?: string | null;
    imagePath?: string | null;
    price: number | string;
    stock: number;
    lowStockThreshold?: number;
  }): Promise<ProductEntity> {
    const [row] = await db
      .insert(products)
      .values({
        storeId: data.storeId,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode ?? null,
        emoji: data.emoji ?? null,
        imagePath: data.imagePath ?? null,
        price: String(data.price),
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold ?? 5,
      })
      .returning();

    if (data.stock > 0) {
      await db.insert(productBatches).values({
        storeId: data.storeId,
        productId: row.id,
        quantity: data.stock,
        initialQuantity: data.stock,
        price: String(data.price),
        status: "active",
      });
    }

    return this.formatProduct(row);
  }

  async update(
    id: number,
    storeId: number,
    data: {
      name?: string;
      emoji?: string | null;
      imagePath?: string | null;
      price?: number | string;
      lowStockThreshold?: number;
    }
  ): Promise<ProductEntity | null> {
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.emoji !== undefined) updateData.emoji = data.emoji;
    if (data.imagePath !== undefined) updateData.imagePath = data.imagePath;
    if (data.price !== undefined) updateData.price = String(data.price);
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;

    const [row] = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt)))
      .returning();

    return row ? this.formatProduct(row) : null;
  }

  async softDelete(id: number, storeId: number): Promise<boolean> {
    const [row] = await db
      .update(products)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt)))
      .returning({ id: products.id });

    return Boolean(row);
  }

  async incrementStock(id: number, storeId: number, quantity: number): Promise<ProductEntity | null> {
    const [row] = await db
      .update(products)
      .set({
        stock: sql`${products.stock} + ${quantity}`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt)))
      .returning();

    return row ? this.formatProduct(row) : null;
  }

  async decrementStock(id: number, storeId: number, quantity: number): Promise<ProductEntity | null> {
    const [row] = await db
      .update(products)
      .set({
        stock: sql`${products.stock} - ${quantity}`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId), isNull(products.deletedAt)))
      .returning();

    return row ? this.formatProduct(row) : null;
  }
}
