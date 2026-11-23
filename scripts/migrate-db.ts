import { db, pool } from "../src/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Applying required schema changes to Neon PostgreSQL...");

  // 1. Add opening_float to shifts
  console.log("Adding opening_float to shifts...");
  await db.execute(sql`
    ALTER TABLE shifts 
    ADD COLUMN IF NOT EXISTS opening_float NUMERIC(12, 2) DEFAULT 500.00;
  `);
  console.log("✅ shifts.opening_float added/verified");

  // 2. Add shift_id to cash_drops
  console.log("Adding shift_id to cash_drops...");
  await db.execute(sql`
    ALTER TABLE cash_drops 
    ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES shifts(id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cash_drops_shift_id_idx ON cash_drops(shift_id);
  `);
  console.log("✅ cash_drops.shift_id added/verified");

  // 3. Add unique partial indexes on products if no duplicates violate them
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS products_store_sku_idx 
      ON products(store_id, lower(sku)) 
      WHERE deleted_at IS NULL;
    `);
    console.log("✅ products_store_sku_idx verified");
  } catch (err: any) {
    console.warn("⚠️ Could not create products_store_sku_idx (may have existing duplicates):", err.message);
  }

  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS products_store_barcode_idx 
      ON products(store_id, barcode) 
      WHERE deleted_at IS NULL;
    `);
    console.log("✅ products_store_barcode_idx verified");
  } catch (err: any) {
    console.warn("⚠️ Could not create products_store_barcode_idx (may have existing duplicates):", err.message);
  }

  // 4. Add unique index on users (store_id, lower(trim(name)))
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS users_store_name_uidx 
      ON users(store_id, lower(trim(name))) 
      WHERE store_id IS NOT NULL;
    `);
    console.log("✅ users_store_name_uidx verified");
  } catch (err: any) {
    console.warn("⚠️ Could not create users_store_name_uidx (may have existing duplicates):", err.message);
  }

  console.log("Migration complete!");
}

runMigration()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
