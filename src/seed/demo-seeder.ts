import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  stores,
  users,
  products,
  shifts,
  sales,
  saleItems,
  stockMovements,
  cashDrops,
  storeExpenses,
} from "@/db/schema";

async function runSeed() {
  console.log("🌱 Starting Stockify Demo Seeder...");

  try {
    // 1. Create or Find Store: Stockify Supermart (STCK01)
    let [store] = await db.select().from(stores).where(eq(stores.code, "STCK01")).limit(1);
    if (!store) {
      [store] = await db
        .insert(stores)
        .values({
          name: "Stockify Supermart",
          type: "sari-sari",
          code: "STCK01",
        })
        .returning();
      console.log(`✅ Created Store: ${store.name} (${store.code})`);
    } else {
      console.log(`ℹ️ Existing Store found: ${store.name} (${store.code})`);
    }

    // 2. Create Owner and Employees
    const hashedPassword = await bcrypt.hash("password", 10);
    const hashedOwnerPin = await bcrypt.hash("1234", 10);

    let [owner] = await db.select().from(users).where(eq(users.email, "owner@stockify.ph")).limit(1);
    if (!owner) {
      [owner] = await db
        .insert(users)
        .values({
          storeId: store.id,
          name: "John Carl",
          email: "owner@stockify.ph",
          password: hashedPassword,
          pin: hashedOwnerPin,
          role: "owner",
        })
        .returning();
      console.log(`✅ Created Owner: ${owner.name} (${owner.email})`);
    }

    const staffMembers = [
      { name: "Maria Santos", pin: "1111" },
      { name: "Carlos Mendoza", pin: "2222" },
      { name: "Ana Reyes", pin: "3333" },
    ];

    const employees = [];
    for (const sm of staffMembers) {
      let [emp] = await db
        .select()
        .from(users)
        .where(sql`${users.storeId} = ${store.id} AND ${users.name} = ${sm.name}`)
        .limit(1);

      if (!emp) {
        const hPin = await bcrypt.hash(sm.pin, 10);
        [emp] = await db
          .insert(users)
          .values({
            storeId: store.id,
            name: sm.name,
            pin: hPin,
            role: "employee",
          })
          .returning();
        console.log(`✅ Created Staff: ${emp.name} (PIN: ${sm.pin})`);
      }
      employees.push(emp);
    }

    // 3. Products
    const defs = [
      { name: "Lucky Me Pancit Canton (Kalamansi)", sku: "NOOD-001", barcode: "4800016644818", price: "18.00", emoji: "🍜", stock: 42, low: 15 },
      { name: "Nescafé 3-in-1 Original Sachet", sku: "COF-001", barcode: "4800361280017", price: "12.00", emoji: "☕", stock: 6, low: 20 },
      { name: "Cooking Oil (350ml Pouch)", sku: "OIL-001", barcode: "4807770270014", price: "35.00", emoji: "🍳", stock: 2, low: 10 },
      { name: "Coke Sakto (200ml Bottle)", sku: "BEV-001", barcode: "4800049720015", price: "15.00", emoji: "🥤", stock: 58, low: 12 },
      { name: "Datu Puti Vinegar (350ml)", sku: "CON-001", barcode: "4801123456789", price: "22.00", emoji: "🧂", stock: 18, low: 8 },
      { name: "Silver Swan Soy Sauce (350ml)", sku: "CON-002", barcode: "4801123456790", price: "20.00", emoji: "🍶", stock: 25, low: 10 },
      { name: "San Miguel Pale Pilsen (Can)", sku: "BEV-002", barcode: "4800049720022", price: "55.00", emoji: "🍺", stock: 30, low: 10 },
      { name: "Safeguard Pure White Soap (60g)", sku: "SOAP-001", barcode: "4800088112233", price: "28.00", emoji: "🧼", stock: 35, low: 8 },
    ];

    const catalog: Array<{ id: number; name: string; sku: string; price: number }> = [];
    for (const d of defs) {
      let [prod] = await db
        .select()
        .from(products)
        .where(sql`${products.storeId} = ${store.id} AND ${products.sku} = ${d.sku}`)
        .limit(1);

      if (!prod) {
        [prod] = await db
          .insert(products)
          .values({
            storeId: store.id,
            name: d.name,
            sku: d.sku,
            barcode: d.barcode,
            emoji: d.emoji,
            price: d.price,
            stock: d.stock,
            lowStockThreshold: d.low,
          })
          .returning();

        await db.insert(stockMovements).values({
          storeId: store.id,
          productId: prod.id,
          userId: owner.id,
          type: "initial",
          quantity: prod.stock,
          note: "Initial seed catalog",
        });
        console.log(`✅ Created Product: ${prod.name}`);
      }
      catalog.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        price: parseFloat(prod.price),
      });
    }

    // Check if sales already seeded
    const [existingSaleCount] = await db
      .select({ count: sql<number>`COUNT(${sales.id})` })
      .from(sales)
      .where(eq(sales.storeId, store.id));

    if (Number(existingSaleCount?.count || 0) < 50) {
      console.log("⏳ Generating 90 days of realistic sales history for STCK01...");

      for (let i = 90; i >= 1; i--) {
        const day = new Date();
        day.setDate(day.getDate() - i);
        day.setHours(7, 0, 0, 0);

        const cashier = employees[i % employees.length];
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const factor = (isWeekend ? 1.3 : 1.0) * (1 + (90 - i) * 0.002);

        const [shift] = await db
          .insert(shifts)
          .values({
            storeId: store.id,
            userId: cashier.id,
            startedAt: day.toISOString(),
            endedAt: new Date(day.getTime() + 14 * 3600 * 1000).toISOString(),
            createdAt: day.toISOString(),
          })
          .returning();

        const orderCount = Math.round((Math.floor(Math.random() * 11) + 18) * factor);

        for (let o = 0; o < orderCount; o++) {
          const orderTime = new Date(day.getTime() + (Math.random() * 13 + 0.5) * 3600 * 1000);
          const itemCount = Math.random() < 0.6 ? 1 : Math.floor(Math.random() * 3) + 2;

          const chosenProducts = [...catalog].sort(() => 0.5 - Math.random()).slice(0, itemCount);

          let saleTotal = 0;
          const orderItems = [];

          for (const cp of chosenProducts) {
            const qty = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 3) + 1;
            const subtotal = cp.price * qty;
            saleTotal += subtotal;
            orderItems.push({
              productId: cp.id,
              productName: cp.name,
              sku: cp.sku,
              unitPrice: String(cp.price),
              quantity: qty,
              subtotal: String(subtotal),
              createdAt: orderTime.toISOString(),
            });
          }

          const [newSale] = await db
            .insert(sales)
            .values({
              storeId: store.id,
              shiftId: shift.id,
              userId: cashier.id,
              total: String(Math.round(saleTotal * 100) / 100),
              soldAt: orderTime.toISOString(),
              createdAt: orderTime.toISOString(),
            })
            .returning();

          for (const item of orderItems) {
            await db.insert(saleItems).values({
              saleId: newSale.id,
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
              createdAt: item.createdAt,
            });
          }
        }
      }
      console.log("✅ 90 days of historical sales and shift data generated successfully!");
    } else {
      console.log("ℹ️ Sales history already exists, skipping sales generation.");
    }

    // 4. Sample Cash Drops and Expenses
    const [existingDrops] = await db.select({ count: sql<number>`COUNT(*)` }).from(cashDrops);
    if (Number(existingDrops?.count || 0) === 0) {
      await db.insert(cashDrops).values([
        { storeId: store.id, userId: owner.id, amount: "3500.00", note: "Midday cash drawer transfer to safe", cashier: "John Carl" },
        { storeId: store.id, userId: employees[0].id, amount: "2000.00", note: "End of shift excess cash collection", cashier: "Maria Santos" },
      ]);
      console.log("✅ Seeded sample cash drops");
    }

    const [existingExpenses] = await db.select({ count: sql<number>`COUNT(*)` }).from(storeExpenses);
    if (Number(existingExpenses?.count || 0) === 0) {
      await db.insert(storeExpenses).values([
        { storeId: store.id, userId: owner.id, title: "Sari-sari store ice replenishment", amount: "120.00", note: "4 ice bags from neighbor supplier" },
        { storeId: store.id, userId: owner.id, title: "Receipt thermal paper roll pack", amount: "250.00", note: "Purchased at office depot" },
      ]);
      console.log("✅ Seeded sample store expenses");
    }

    console.log("✨ Stockify demo seeding completed successfully!");
  } catch (err) {
    console.error("❌ Demo Seeder Error:", err);
  } finally {
    await pool.end();
  }
}

runSeed();
