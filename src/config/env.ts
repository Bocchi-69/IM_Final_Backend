import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Resolve .env from process.cwd() or project directories
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "prod-deployment-appsdev/.env"),
  path.resolve(currentDir, "../.env"),
  path.resolve(currentDir, "../../.env"),
];

for (const envPath of candidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "fallback_secret_change_me") {
    throw new Error("FATAL: JWT_SECRET must be set to a secure, unique secret in production environment!");
  }
  if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET.trim() === "") {
    throw new Error("FATAL: CSRF_SECRET must be set in production environment!");
  }
}

export const ENV = {
  APP_NAME: process.env.APP_NAME || "Stockify POS API",
  PORT: parseInt(process.env.PORT || (process.env.NODE_ENV === "production" ? "10000" : "3001"), 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "fallback_secret_change_me",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [],
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3001",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/tindahan",
  CSRF_SECRET: process.env.CSRF_SECRET,
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || "").trim(),
  GEMINI_MODELS: process.env.GEMINI_MODELS
    ? process.env.GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"],
};
