import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ENV } from "@/config/env";
import * as schema from "./schema";

if (!ENV.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in configuration");
}

// Ensure SSL connection works seamlessly with cloud providers (Neon, Supabase, RDS, AWS, Heroku)
const needsSsl =
  ENV.DATABASE_URL.includes("neon.tech") ||
  ENV.DATABASE_URL.includes("supabase.co") ||
  ENV.DATABASE_URL.includes("sslmode=require") ||
  ENV.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const db = drizzle({ client: pool, schema });
