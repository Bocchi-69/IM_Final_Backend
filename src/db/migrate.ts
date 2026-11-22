import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "@/db";

async function main() {
  console.log("⏳ Applying database migrations...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Database migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
