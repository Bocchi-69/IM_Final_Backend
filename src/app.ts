import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";
import { ENV } from "@/config/env";
import routes from "@/routes";
import { generalApiLimiter } from "@/middlewares/rate-limit-middleware";

const app = express();

// Trust reverse proxy (e.g. Render, Railway, Nginx, Fly.io, Cloudflare)
app.set("trust proxy", 1);

// --- Security & Parsing Middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Strict Production CORS Configuration
const isProduction = ENV.NODE_ENV === "production";
const cleanOrigin = (url: string) => url.trim().replace(/\/+$/, "");

const rawAllowed = [ENV.FRONTEND_URL, ...ENV.ALLOWED_ORIGINS];
const allowedOrigins = new Set<string>(rawAllowed.map(cleanOrigin).filter(Boolean));

if (!isProduction) {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = cleanOrigin(origin);

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      // Automatically allow Vercel production and preview deployment URLs (*.vercel.app)
      try {
        const hostname = new URL(origin).hostname;
        if (hostname.endsWith(".vercel.app")) {
          return callback(null, true);
        }
      } catch {
        // Invalid origin format
      }

      // In local development, permit any localhost / 127.0.0.1 port
      if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Reject unauthorized cross-origin requests
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token", "Accept"],
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());
app.use(hpp());

// --- Static Storage (Product Uploaded Images) ---
const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

const candidateDirs = [
  path.resolve(process.cwd(), "public/storage"),
  path.resolve(process.cwd(), "prod-deployment-appsdev/public/storage"),
  path.resolve(currentDir, "../public/storage"),
  path.resolve(currentDir, "../../public/storage"),
];

let storageDir = candidateDirs.find((dir) => fs.existsSync(dir));
if (!storageDir) {
  storageDir = fs.existsSync(path.resolve(process.cwd(), "prod-deployment-appsdev"))
    ? path.resolve(process.cwd(), "prod-deployment-appsdev/public/storage")
    : path.resolve(process.cwd(), "public/storage");
}
fs.mkdirSync(path.join(storageDir, "products"), { recursive: true });

const staticMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "public, max-age=86400");
  next();
};

app.use("/storage", staticMiddleware, express.static(storageDir));
app.use("/api/storage", staticMiddleware, express.static(storageDir));

// --- System & Deployment Health Checks (Before Rate Limiters) ---
app.get("/up", (_req: Request, res: Response) => {
  res.status(200).type("text/plain").send("Application up");
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: `${ENV.APP_NAME} is healthy`,
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: `${ENV.APP_NAME} instance is operational`,
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
  });
});

// --- General API Rate Limiting ---
app.use("/api", generalApiLimiter);

// --- Mount Application API Routes ---
app.use("/api", routes);

// --- 404 Handler ---
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// --- Global Error Handler ---
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("Global Error Hook:", err.message);

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: ENV.NODE_ENV === "production" ? "Internal Server Error" : err.message,
    ...(ENV.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export default app;
