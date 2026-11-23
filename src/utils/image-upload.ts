import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB limit

/**
 * Validates magic bytes for allowed image types (PNG, JPEG, WEBP).
 * Rejects SVGs, HTML, scripts, and corrupted binaries.
 */
export function detectImageType(buffer: Buffer): "png" | "jpg" | "webp" | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }

  // WEBP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

/**
 * Validates that hostnames are not local/private/cloud metadata addresses to block SSRF.
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa") ||
    host.endsWith(".onion")
  ) {
    return true;
  }

  // Check IPv4 private and link-local ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const [, b1, b2] = match.map(Number);
    if (b1 === 127) return true; // Loopback
    if (b1 === 10) return true; // Private class A
    if (b1 === 169 && b2 === 254) return true; // Link-local / AWS / Cloud metadata
    if (b1 === 192 && b2 === 168) return true; // Private class C
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true; // Private class B
    if (b1 === 0) return true; // Zero address
  }

  // Check IPv6 loopback and unique local / link local
  if (
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc00:") ||
    host.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

/**
 * Saves a base64 encoded data URI to disk after enforcing:
 * - Allowed types: png, jpg/jpeg, webp (SVG explicitly rejected)
 * - Size limit: <= 2 MB
 * - Magic bytes verification
 */
export function saveBase64Image(dataUri: string): string | null {
  try {
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUri)) {
      return null;
    }

    const parts = dataUri.split(";base64,");
    if (parts.length !== 2) return null;

    const buffer = Buffer.from(parts[1], "base64");
    if (buffer.length < 50 || buffer.length > MAX_IMAGE_BYTES) {
      return null;
    }

    const ext = detectImageType(buffer);
    if (!ext) {
      console.warn("Rejected base64 image: magic bytes mismatch");
      return null;
    }

    const storageDir = path.resolve(process.cwd(), "public/storage/products");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filename = `${crypto.randomBytes(20).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(storageDir, filename), buffer);

    return `products/${filename}`;
  } catch (e) {
    console.error("saveBase64Image Error:", e);
    return null;
  }
}

/**
 * Downloads an external image URL after enforcing:
 * - SSRF verification re-checked on EVERY redirect hop
 * - Disallowing SVG and checking Content-Type header
 * - Size limit: <= 2 MB
 * - Magic bytes verification
 */
export async function downloadAndSaveImageUrl(initialUrl: string): Promise<string | null> {
  try {
    let currentUrl = initialUrl.trim();
    const maxRedirects = 5;
    let redirectCount = 0;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      while (redirectCount <= maxRedirects) {
        const parsed = new URL(currentUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return null;
        }

        // SSRF Protection: Re-check on each redirect
        if (isPrivateOrLocalHost(parsed.hostname)) {
          console.warn("Blocked SSRF attempt to private/internal host:", parsed.hostname);
          return null;
        }

        const res = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual", // Guard redirects manually to re-verify host
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/jpeg,image/png,image/webp",
          },
        });

        // Handle redirect
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get("location");
          if (!location) return null;
          currentUrl = new URL(location, currentUrl).href;
          redirectCount++;
          continue;
        }

        if (!res.ok) return null;

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        // Disallow SVG and non-images
        if (
          contentType.includes("svg") ||
          (!contentType.startsWith("image/jpeg") &&
            !contentType.startsWith("image/png") &&
            !contentType.startsWith("image/webp") &&
            !contentType.startsWith("image/jpg"))
        ) {
          return null;
        }

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
          return null;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 50 || buffer.length > MAX_IMAGE_BYTES) return null;

        const ext = detectImageType(buffer);
        if (!ext) {
          console.warn("Rejected image download: magic bytes do not match allowed formats (jpg, png, webp)");
          return null;
        }

        const storageDir = path.resolve(process.cwd(), "public/storage/products");
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }

        const filename = `${crypto.randomBytes(20).toString("hex")}.${ext}`;
        fs.writeFileSync(path.join(storageDir, filename), buffer);

        return `products/${filename}`;
      }
    } finally {
      clearTimeout(timeout);
    }

    return null;
  } catch (err) {
    console.warn("downloadAndSaveImageUrl notice:", err);
    return null;
  }
}
