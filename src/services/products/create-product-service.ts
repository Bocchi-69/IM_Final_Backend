import { ProductRepository } from "@/repositories/product-repository";
import { StockMovementRepository } from "@/repositories/stock-movement-repository";
import type { CreateProductInput } from "@/schema/product-schema";
import { saveBase64Image, downloadAndSaveImageUrl } from "@/utils/image-upload";

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
  } catch (error: any) {
    if (error?.code === "23505") {
      const constraint = (error?.constraint || "").toLowerCase();
      const detail = (error?.detail || "").toLowerCase();
      if (constraint.includes("sku") || detail.includes("sku")) {
        return { code: 422, status: "error", message: "The sku has already been taken." };
      }
      if (constraint.includes("barcode") || detail.includes("barcode")) {
        return { code: 422, status: "error", message: "The barcode has already been taken." };
      }
      return { code: 422, status: "error", message: "A product with this SKU or barcode already exists." };
    }
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

  let seq = (await repo.getStoreProductCount(storeId)) + 1;
  let sku = `${prefix}-${String(seq).padStart(3, "0")}`;

  while (await repo.checkSkuExists(storeId, sku)) {
    seq++;
    sku = `${prefix}-${String(seq).padStart(3, "0")}`;
  }

  return sku;
}
