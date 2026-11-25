import { pool } from "@/db";

async function createBatchesTable() {
  const client = await pool.connect();
  try {
    console.log("Creating product_batches table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_batches (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        initial_quantity INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS product_batches_store_idx ON product_batches(store_id);
      CREATE INDEX IF NOT EXISTS product_batches_product_idx ON product_batches(product_id);
      CREATE INDEX IF NOT EXISTS product_batches_status_idx ON product_batches(status);
    `);
    console.log("✅ product_batches table created or already exists.");
  } finally {
    client.release();
    process.exit(0);
  }
}

createBatchesTable().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
