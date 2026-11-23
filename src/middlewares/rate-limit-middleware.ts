import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

interface RateLimiterOptions {
  windowMs: number; // Duration of window in ms
  max: number; // Max requests allowed within windowMs
  message?: string;
  keyGenerator?: (req: Request, res: Response) => string | Promise<string>;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later.",
    keyGenerator,
  } = options;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: true,
    validate: { xForwardedForHeader: false, default: true },
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req: Request, res: Response) => {
      const resetTime = (req as any).rateLimit?.resetTime;
      const resetSeconds = resetTime
        ? Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 1000))
        : Math.ceil(windowMs / 1000);

      res.setHeader("Retry-After", resetSeconds);
      return res.status(429).json({
        code: 429,
        status: "error",
        message,
        retryAfter: resetSeconds,
      });
    },
  });
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
