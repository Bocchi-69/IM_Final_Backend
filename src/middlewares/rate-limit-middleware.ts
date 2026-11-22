import type { Request, Response, NextFunction } from "express";

interface RateLimiterOptions {
  windowMs: number; // Duration of window in ms
  max: number; // Max requests allowed within windowMs
  message?: string;
  keyGenerator?: (req: Request) => string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later.",
    keyGenerator = (req: Request) => {
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim();
      }
      return req.ip || req.socket.remoteAddress || "unknown-client";
    },
  } = options;

  const storage = new Map<string, ClientRecord>();

  // Cleanup expired client records periodically every 5 minutes to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of storage.entries()) {
      if (now > record.resetTime) {
        storage.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it doesn't prevent Node process from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = storage.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      storage.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader("Retry-After", resetSeconds);
      return res.status(429).json({
        code: 429,
        status: "error",
        message,
        retryAfter: resetSeconds,
      });
    }

    return next();
  };
}

// 1. Strict Auth Limiter: Protects login & PIN verification from brute force attacks
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 minutes per IP
  message: "Too many authentication attempts. Please wait 15 minutes before trying again.",
});

// 2. Registration Limiter: Prevents spam store account creation
export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: "Too many store registration attempts. Please try again later.",
});

// 3. AI Copilot Limiter: Prevents quota exhaustion or runaway costs
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 chat messages per minute per IP
  message: "AI rate limit reached. Please wait a moment before sending another prompt.",
});

// 4. General API Limiter: Protects all public endpoints against DDoS or scraping
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  message: "Too many requests from this IP. Please slow down.",
});
