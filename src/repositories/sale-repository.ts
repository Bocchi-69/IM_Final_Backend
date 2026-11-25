import { eq, and, gte, lte, inArray, desc, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { sales, saleItems, products, stockMovements, productBatches } from "@/db/schema";

export class SaleRepository {
  async recordSale(
    userId: number,
    storeId: number,
    shiftId: number,
    itemsInput: { product_id: number; quantity: number }[],
    cashReceived?: number
  ) {
    // Group quantities by product_id
    const wantedMap = new Map<number, number>();
    for (const it of itemsInput) {
      wantedMap.set(it.product_id, (wantedMap.get(it.product_id) || 0) + it.quantity);
    }
    const productIds = Array.from(wantedMap.keys());

    return await db.transaction(async (tx) => {
      // 1. Fetch products with row-level lock (FOR UPDATE) to prevent concurrency race conditions
      const prodRows = await tx
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.id, productIds)))
        .for("update");

      const prodMap = new Map(prodRows.map((p) => [p.id, p]));

      // 2. Validate stock and pre-calculate total using integer cents (centavos)
      let grandTotalCents = 0;
      for (const [pId, qty] of wantedMap.entries()) {
        const prod = prodMap.get(pId);
        if (!prod) {
          throw new Error("Unknown product in cart.");
        }
        if (prod.stock < qty) {
          throw new Error(`Only ${prod.stock} ${prod.name} in stock.`);
        }
        const unitPriceCents = Math.round(parseFloat(prod.price) * 100);
        grandTotalCents += unitPriceCents * qty;
      }
      const grandTotal = Math.round(grandTotalCents) / 100;

      // Validate cash tendered against grand total if provided
      if (cashReceived !== undefined) {
        const cashCents = Math.round(cashReceived * 100);
        if (cashCents < grandTotalCents) {
          throw new Error(
            `Insufficient cash received (₱${cashReceived.toFixed(2)}). Total amount due is ₱${grandTotal.toFixed(2)}.`
          );
        }
      }

      // 3. Insert sale with pre-calculated grandTotal
      const [newSale] = await tx
        .insert(sales)
        .values({
          storeId,
          shiftId,
          userId,
          total: grandTotal.toFixed(2),
          soldAt: new Date().toISOString(),
        })
        .returning();

      const insertedItems = [];

      // 4. Decrement stock, create sale item, create stock movement
      for (const [pId, qty] of wantedMap.entries()) {
        const prod = prodMap.get(pId)!;
        const unitPriceCents = Math.round(parseFloat(prod.price) * 100);
        const subtotalCents = unitPriceCents * qty;
        const unitPrice = (unitPriceCents / 100).toFixed(2);
        const subtotal = (subtotalCents / 100).toFixed(2);

        // Decrement product stock atomically
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${qty}`,
            updatedAt: new Date().toISOString(),
          })
          .where(and(eq(products.id, pId), eq(products.storeId, storeId)));

        // FIFO deduction from product batches
        const batches = await tx
          .select()
          .from(productBatches)
          .where(
            and(
              eq(productBatches.productId, pId),
              eq(productBatches.storeId, storeId),
              eq(productBatches.status, "active"),
              sql`${productBatches.quantity} > 0`
            )
          )
          .orderBy(asc(productBatches.id))
          .for("update");

        // If no batches exist for this product (legacy data), create an initial batch for the stock before deduction
        if (batches.length === 0 && prod.stock > 0) {
          const [legacyBatch] = await tx
            .insert(productBatches)
            .values({
              storeId,
              productId: pId,
              quantity: prod.stock,
              initialQuantity: prod.stock,
              price: prod.price,
              status: "active",
            })
            .returning();
          batches.push(legacyBatch);
        }

        let needed = qty;
        for (const b of batches) {
          if (needed <= 0) break;
          const take = Math.min(b.quantity, needed);
          const remainingInBatch = b.quantity - take;
          const newStatus = remainingInBatch === 0 ? "exhausted" : "active";
          await tx
            .update(productBatches)
            .set({
              quantity: remainingInBatch,
              status: newStatus,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(productBatches.id, b.id));
          needed -= take;
        }

        // Check if the old batch was exhausted and if there is a next active batch with a new price!
        const [nextActiveBatch] = await tx
          .select()
          .from(productBatches)
          .where(
            and(
              eq(productBatches.productId, pId),
              eq(productBatches.storeId, storeId),
              eq(productBatches.status, "active"),
              sql`${productBatches.quantity} > 0`
            )
          )
          .orderBy(asc(productBatches.id))
          .limit(1);

        if (nextActiveBatch && nextActiveBatch.price !== prod.price) {
          // Old batch sold out! Automatically transition product price to the next batch's price!
          await tx
            .update(products)
            .set({
              price: nextActiveBatch.price,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(products.id, pId));
        }

        // Create sale item
        const [saleItem] = await tx
          .insert(saleItems)
          .values({
            saleId: newSale.id,
            productId: pId,
            productName: prod.name,
            sku: prod.sku,
            unitPrice: unitPrice,
            quantity: qty,
            subtotal: subtotal,
          })
          .returning();

        insertedItems.push({
          id: saleItem.id,
          sale_id: saleItem.saleId,
          product_id: saleItem.productId,
          product_name: saleItem.productName,
          sku: saleItem.sku,
          unit_price: parseFloat(saleItem.unitPrice),
          quantity: saleItem.quantity,
          subtotal: parseFloat(saleItem.subtotal),
        });

        // Create stock movement
        await tx.insert(stockMovements).values({
          storeId,
          productId: pId,
          userId,
          type: "sale",
          quantity: -qty,
          note: `Sale #${newSale.id}`,
        });
      }

      return {
        id: newSale.id,
        store_id: newSale.storeId,
        shift_id: newSale.shiftId,
        user_id: newSale.userId,
        total: grandTotal,
        sold_at: newSale.soldAt,
        items: insertedItems,
      };
    });
  }

  async getSalesSince(storeId: number, sinceDate: Date) {
    const saleRows = await db
      .select()
      .from(sales)
      .where(and(eq(sales.storeId, storeId), gte(sales.soldAt, sinceDate.toISOString())));

    if (saleRows.length === 0) return [];

    const saleIds = saleRows.map((s) => s.id);
    const itemRows = await db
      .select()
      .from(saleItems)
      .where(inArray(saleItems.saleId, saleIds));

    const itemsBySale = new Map<number, any[]>();
    for (const item of itemRows) {
      const list = itemsBySale.get(item.saleId) || [];
      list.push({
        id: item.id,
        product_id: item.productId,
        product_name: item.productName,
        sku: item.sku,
        unit_price: parseFloat(item.unitPrice),
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal),
      });
      itemsBySale.set(item.saleId, list);
    }

    return saleRows.map((s) => ({
      id: s.id,
      store_id: s.storeId,
      shift_id: s.shiftId,
      user_id: s.userId,
      total: parseFloat(s.total),
      sold_at: s.soldAt,
      items: itemsBySale.get(s.id) || [],
    }));
  }

  async getSalesBetween(storeId: number, start: Date, end: Date) {
    const saleRows = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          gte(sales.soldAt, start.toISOString()),
          lte(sales.soldAt, end.toISOString())
        )
      );

    if (saleRows.length === 0) return [];

    const saleIds = saleRows.map((s) => s.id);
    const itemRows = await db
      .select()
      .from(saleItems)
      .where(inArray(saleItems.saleId, saleIds));

    const itemsBySale = new Map<number, any[]>();
    for (const item of itemRows) {
      const list = itemsBySale.get(item.saleId) || [];
      list.push({
        id: item.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal),
      });
      itemsBySale.set(item.saleId, list);
    }

    return saleRows.map((s) => ({
      id: s.id,
      total: parseFloat(s.total),
      sold_at: s.soldAt,
      items: itemsBySale.get(s.id) || [],
    }));
  }

  async getTopProducts(storeId: number, fromDate: Date, limit = 5) {
    const rows = await db
      .select({
        name: saleItems.productName,
        qty: sql<number>`SUM(${saleItems.quantity})`,
        amount: sql<number>`SUM(${saleItems.subtotal})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(eq(sales.storeId, storeId), gte(sales.soldAt, fromDate.toISOString())))
      .groupBy(saleItems.productName)
      .orderBy(desc(sql`SUM(${saleItems.subtotal})`))
      .limit(limit);

    return rows.map((r) => ({
      name: r.name,
      qty: parseInt(String(r.qty), 10),
      amount: parseFloat(String(r.amount)),
    }));
  }
}
