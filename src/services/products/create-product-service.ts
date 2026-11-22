import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ProductRepository } from "@/repositories/product-repository";
import { StockMovementRepository } from "@/repositories/stock-movement-repository";
import type { CreateProductInput } from "@/schema/product-schema";

export async function createProductService(
  storeId: number,
  userId: number,
  input: CreateProductInput
) {
  const productRepo = new ProductRepository();
  const movementRepo = new StockMovementRepository();

  try {
    let sku = input.sku?.trim().toUpperCase();

    // Check custom SKU or generate automatic SKU
    if (sku) {
      const exists = await productRepo.checkSkuExists(storeId, sku);
      if (exists) {
        return { code: 422, status: "error", message: "The sku has already been taken." };
      }
    } else {
      sku = await generateSku(productRepo, storeId, input.name);
    }

    // Check barcode uniqueness or generate automatic 13-digit barcode
    let barcode = input.barcode?.trim() || null;
    if (barcode) {
      const barcodeExists = await productRepo.checkBarcodeExists(storeId, barcode);
      if (barcodeExists) {
        return { code: 422, status: "error", message: "The barcode has already been taken." };
      }
    } else {
      barcode = await generateUniqueBarcode(productRepo, storeId);
    }

    // Handle image (base64 data URI, image_path, or image_url)
    let imagePath: string | null = null;
    const rawUrl =
      input.image_url?.trim() ||
      (typeof input.image === "string" && input.image.startsWith("http") ? input.image.trim() : null) ||
      input.image_path?.trim();

    if (typeof input.image === "string" && input.image.startsWith("data:image")) {
      imagePath = saveBase64Image(input.image);
    } else if (rawUrl) {
      // Try to download and cache locally so it never breaks or gets blocked by cross-origin referrer
      const downloaded = await downloadAndSaveImageUrl(rawUrl);
      imagePath = downloaded || rawUrl;
    }

    // Create product
    const product = await productRepo.create({
      storeId,
      name: input.name,
      sku,
      barcode,
      emoji: input.emoji || null,
      imagePath,
      price: input.price,
      stock: input.stock,
      lowStockThreshold: input.low_stock_threshold || 5,
    });

    // Create initial stock movement
    await movementRepo.create({
      storeId,
      productId: product.id,
      userId,
      type: "initial",
      quantity: product.stock,
    });

    return {
      code: 201,
      status: "success",
      message: "Product created successfully",
      data: product,
    };
  } catch (error) {
    console.error("createProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to create product" };
  }
}

export function calculateEan13CheckDigit(base12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i], 10) || 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const rem = sum % 10;
  return rem === 0 ? "0" : (10 - rem).toString();
}

export async function generateUniqueBarcode(repo: ProductRepository, storeId: number): Promise<string> {
  let barcode = "";
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 100) {
    attempts++;
    // GS1 prefix 200 (in-store retail) + 9 random digits = 12 digits
    const base12 = "200" + Math.floor(100000000 + Math.random() * 900000000).toString();
    const check = calculateEan13CheckDigit(base12);
    barcode = base12 + check;
    exists = await repo.checkBarcodeExists(storeId, barcode);
  }

  return barcode;
}

export async function generateSku(repo: ProductRepository, storeId: number, name: string): Promise<string> {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let prefix: string;
  if (words.length >= 2) {
    prefix = words.map((w) => w.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)).join("").slice(0, 4).toUpperCase();
  } else {
    prefix = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  }
  if (!prefix || prefix.length < 2) prefix = "PRD";

  let max = (await repo.getMaxId()) + 1;
  let sku = `${prefix}-${String(max).padStart(3, "0")}`;

  while (await repo.checkSkuExists(storeId, sku)) {
    max++;
    sku = `${prefix}-${String(max).padStart(3, "0")}`;
  }

  return sku;
}

function saveBase64Image(dataUri: string): string | null {
  try {
    const parts = dataUri.split(";base64,");
    if (parts.length !== 2) return null;

    const mime = parts[0].replace(/^data:/, "").split("/")[1] || "png";
    let ext = mime.toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    if (ext.includes("svg")) ext = "svg";
    if (ext.includes("webp")) ext = "webp";

    const data = Buffer.from(parts[1], "base64");

    const storageDir = path.resolve(process.cwd(), "public/storage/products");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filename = `${crypto.randomBytes(20).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(storageDir, filename), data);

    return `products/${filename}`;
  } catch (e) {
    console.error("saveBase64Image Error:", e);
    return null;
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa")
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

  // Check IPv6 loopback and unique local
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc00:") || host.startsWith("fd00:")) {
    return true;
  }

  return false;
}

async function downloadAndSaveImageUrl(url: string): Promise<string | null> {
  try {
    const clean = url.trim();
    const parsed = new URL(clean);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // SSRF Protection: Prevent SSRF calls to local/private/cloud metadata endpoints
    if (isPrivateOrLocalHost(parsed.hostname)) {
      console.warn("Blocked SSRF attempt to private/internal host:", parsed.hostname);
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(clean, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    // Verify that the response is actually an image
    if (!contentType.startsWith("image/")) {
      return null;
    }

    let ext = "jpg";
    if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("webp")) ext = "webp";
    else if (contentType.includes("gif")) ext = "gif";
    else if (contentType.includes("svg")) ext = "svg";

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 50) return null;

    const storageDir = path.resolve(process.cwd(), "public/storage/products");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filename = `${crypto.randomBytes(20).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(storageDir, filename), buffer);

    return `products/${filename}`;
  } catch (err) {
    console.warn("downloadAndSaveImageUrl notice:", err);
    return null;
  }
}
