import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, productBatches, sales, saleItems, stockMovements, shifts } from "@/db/schema";
import { restockProductService } from "@/services/products/restock-product-service";
import { SaleRepository } from "@/repositories/sale-repository";

async function runFifoTest() {
  console.log("🧪 Starting Option B (FIFO Batch Tracking) Integration Test...\n");

  const storeId = 1;
  const userId = 1;

  // Find or create an active shift for testing sales
  let [shift] = await db.select().from(shifts).where(and(eq(shifts.userId, userId), eq(shifts.storeId, storeId)));
  if (!shift) {
    [shift] = await db.insert(shifts).values({
      storeId,
      userId,
      openingFloat: "500.00",
      startedAt: new Date().toISOString(),
    }).returning();
  }

  // Step 1: Create initial product with 3 units @ ₱80.00
  console.log("--- STEP 1: Create initial product with 3 units @ ₱80.00 ---");
  const [prod] = await db
    .insert(products)
    .values({
      storeId,
      name: "TEST_FIFO_COKE_" + Date.now(),
      sku: "FIFO-SKU-" + Date.now(),
      price: "80.00",
      stock: 3,
      lowStockThreshold: 5,
    })
    .returning();

  // Create initial batch for this product
  await db.insert(productBatches).values({
    storeId,
    productId: prod.id,
    quantity: 3,
    initialQuantity: 3,
    price: "80.00",
    status: "active",
  });

  console.log(`Initial product created: ${prod.name}, Stock: ${prod.stock}, Price: ₱${prod.price}`);

  // Step 2: Owner restocks first time (+10 units @ ₱99.00)
  console.log("\n--- STEP 2: Restock 1: +10 units with new price ₱99.00 ---");
  const res1 = await restockProductService(prod.id, storeId, userId, {
    quantity: 10,
    new_price: 99.00,
  });

  const [afterRestock1] = await db.select().from(products).where(eq(products.id, prod.id));
  console.log(`After Restock 1: Stock = ${afterRestock1.stock} (expected 13), Price = ₱${afterRestock1.price} (expected 80.00)`);
  const check1 = afterRestock1.stock === 13 && parseFloat(afterRestock1.price) === 80.00;
  console.log(`Check 1: ${check1 ? "✅ PASSED" : "❌ FAILED"}`);

  // Step 3: Owner restocks AGAIN before old stock sells out (+10 units @ ₱100.00)
  console.log("\n--- STEP 3: Restock 2: +10 units with new price ₱100.00 (before old stock sold out) ---");
  const res2 = await restockProductService(prod.id, storeId, userId, {
    quantity: 10,
    new_price: 100.00,
  });

  const [afterRestock2] = await db.select().from(products).where(eq(products.id, prod.id));
  console.log(`After Restock 2: Stock = ${afterRestock2.stock} (expected 23), Price = ₱${afterRestock2.price} (expected 80.00)`);

  const activeBatches = await db.select().from(productBatches).where(
    and(eq(productBatches.productId, prod.id), eq(productBatches.status, "active"))
  );
  console.log("Current Active Batches Queue in DB:", activeBatches.map(b => ({
    id: b.id,
    qty: b.quantity,
    price: b.price,
  })));

  const check2 = afterRestock2.stock === 23 && parseFloat(afterRestock2.price) === 80.00 && activeBatches.length === 3;
  console.log(`Check 2: ${check2 ? "✅ PASSED" : "❌ FAILED"}`);

  // Step 4: Sell 3 units (exhausting the first batch of ₱80.00)
  console.log("\n--- STEP 4: Customer buys 3 units (exhausting Batch 1 @ ₱80.00) ---");
  const saleRepo = new SaleRepository();
  const sale1 = await saleRepo.recordSale(userId, storeId, shift.id, [
    { product_id: prod.id, quantity: 3 }
  ]);

  const [afterSale1] = await db.select().from(products).where(eq(products.id, prod.id));
  console.log(`After Sale 1: Stock = ${afterSale1.stock} (expected 20), Price = ₱${afterSale1.price} (expected 99.00)`);
  const check3 = afterSale1.stock === 20 && parseFloat(afterSale1.price) === 99.00;
  console.log(`Check 3 (Automatic transition to ₱99.00): ${check3 ? "✅ PASSED" : "❌ FAILED"}`);

  // Step 5: Sell 10 units (exhausting Batch 2 @ ₱99.00)
  console.log("\n--- STEP 5: Customer buys 10 units (exhausting Batch 2 @ ₱99.00) ---");
  const sale2 = await saleRepo.recordSale(userId, storeId, shift.id, [
    { product_id: prod.id, quantity: 10 }
  ]);

  const [afterSale2] = await db.select().from(products).where(eq(products.id, prod.id));
  console.log(`After Sale 2: Stock = ${afterSale2.stock} (expected 10), Price = ₱${afterSale2.price} (expected 100.00)`);
  const check4 = afterSale2.stock === 10 && parseFloat(afterSale2.price) === 100.00;
  console.log(`Check 4 (Automatic transition to ₱100.00): ${check4 ? "✅ PASSED" : "❌ FAILED"}`);

  // Cleanup test data
  console.log("\n🧹 Cleaning up test data...");
  await db.delete(saleItems).where(eq(saleItems.productId, prod.id));
  await db.delete(sales).where(eq(sales.id, sale1.id));
  await db.delete(sales).where(eq(sales.id, sale2.id));
  await db.delete(stockMovements).where(eq(stockMovements.productId, prod.id));
  await db.delete(productBatches).where(eq(productBatches.productId, prod.id));
  await db.delete(products).where(eq(products.id, prod.id));
  console.log("✅ Cleanup finished.");

  if (check1 && check2 && check3 && check4) {
    console.log("\n🎉 ALL OPTION B (FIFO BATCH TRACKING) TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  } else {
    console.error("\n❌ TEST FAILED!");
    process.exit(1);
  }
}

runFifoTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
