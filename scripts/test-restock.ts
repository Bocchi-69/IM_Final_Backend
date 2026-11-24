import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { restockProductService } from "@/services/products/restock-product-service";
import { eq } from "drizzle-orm";

async function runTest() {
  console.log("🧪 Starting restockProductService tests...\n");

  const storeId = 1;
  const userId = 1;

  // Test 1: Product with stock = 0 (sold out) -> Restock with new_price -> Price SHOULD update
  console.log("--- TEST 1: Sold out product (stock = 0) with new_price ---");
  const [prod1] = await db
    .insert(products)
    .values({
      storeId,
      name: "TEST_ITEM_SOLDOUT_" + Date.now(),
      sku: "TEST-SKU-1-" + Date.now(),
      price: "10.00",
      stock: 0,
      lowStockThreshold: 5,
    })
    .returning();

  console.log(`Initial product created: ${prod1.name}, Stock: ${prod1.stock}, Price: ₱${prod1.price}`);

  const res1 = await restockProductService(prod1.id, storeId, userId, {
    quantity: 10,
    new_price: 18.50,
  });

  console.log("Restock response:", {
    code: res1.code,
    status: res1.status,
    message: res1.message,
    updatedStock: res1.data?.stock,
    updatedPrice: res1.data?.price,
  });

  // Verify in DB
  const [verified1] = await db.select().from(products).where(eq(products.id, prod1.id));
  const test1Passed = verified1.stock === 10 && parseFloat(verified1.price) === 18.50;
  console.log(`Test 1 Result: ${test1Passed ? "✅ PASSED" : "❌ FAILED"}`);
  if (!test1Passed) {
    console.error(`Expected stock: 10, price: 18.50. Got stock: ${verified1.stock}, price: ${verified1.price}`);
  }

  // Test 2: Product with stock > 0 (NOT sold out) with new_price -> Price should NOT update immediately
  console.log("\n--- TEST 2: In-stock product (stock > 0) with new_price ---");
  const [prod2] = await db
    .insert(products)
    .values({
      storeId,
      name: "TEST_ITEM_INSTOCK_" + Date.now(),
      sku: "TEST-SKU-2-" + Date.now(),
      price: "25.00",
      stock: 8,
      lowStockThreshold: 5,
    })
    .returning();

  console.log(`Initial product created: ${prod2.name}, Stock: ${prod2.stock}, Price: ₱${prod2.price}`);

  const res2 = await restockProductService(prod2.id, storeId, userId, {
    quantity: 12,
    new_price: 32.00,
  });

  console.log("Restock response:", {
    code: res2.code,
    status: res2.status,
    message: res2.message,
    updatedStock: res2.data?.stock,
    updatedPrice: res2.data?.price,
  });

  const [verified2] = await db.select().from(products).where(eq(products.id, prod2.id));
  const test2Passed = verified2.stock === 20 && parseFloat(verified2.price) === 25.00;
  console.log(`Test 2 Result: ${test2Passed ? "✅ PASSED" : "❌ FAILED"}`);
  if (!test2Passed) {
    console.error(`Expected stock: 20, price: 25.00. Got stock: ${verified2.stock}, price: ${verified2.price}`);
  }

  // Test 3: Normal restock without new_price -> Price remains unchanged
  console.log("\n--- TEST 3: Normal restock without new_price ---");
  const res3 = await restockProductService(prod1.id, storeId, userId, {
    quantity: 5,
  });

  const [verified3] = await db.select().from(products).where(eq(products.id, prod1.id));
  const test3Passed = verified3.stock === 15 && parseFloat(verified3.price) === 18.50;
  console.log(`Test 3 Result: ${test3Passed ? "✅ PASSED" : "❌ FAILED"}`);

  // Cleanup test data
  await db.delete(stockMovements).where(eq(stockMovements.productId, prod1.id));
  await db.delete(stockMovements).where(eq(stockMovements.productId, prod2.id));
  await db.delete(products).where(eq(products.id, prod1.id));
  await db.delete(products).where(eq(products.id, prod2.id));
  console.log("\n🧹 Cleaned up test records from database.");

  if (test1Passed && test2Passed && test3Passed) {
    console.log("\n🎉 ALL BACKEND RESTOCK TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("\n❌ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTest().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
