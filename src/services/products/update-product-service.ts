import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ProductRepository } from "@/repositories/product-repository";
import type { UpdateProductInput } from "@/schema/product-schema";

export async function updateProductService(
  productId: number,
  storeId: number,
  input: UpdateProductInput
) {
  const productRepo = new ProductRepository();

  try {
    const existing = await productRepo.findById(productId, storeId);
    if (!existing) {
      return { code: 404, status: "error", message: "Product not found" };
    }

    let imagePath = input.image_path || input.image_url || undefined;
    if (typeof input.image === "string" && input.image.startsWith("data:image")) {
      const saved = saveBase64Image(input.image);
      if (saved) imagePath = saved;
    }

    const updated = await productRepo.update(productId, storeId, {
      name: input.name,
      emoji: input.emoji,
      imagePath,
      price: input.price,
      lowStockThreshold: input.low_stock_threshold,
    });

    return {
      code: 200,
      status: "success",
      message: "Product updated successfully",
      data: updated,
    };
  } catch (error) {
    console.error("updateProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to update product" };
  }
}

function saveBase64Image(dataUri: string): string | null {
  try {
    const matches = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return null;

    let ext = matches[1].toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    const data = Buffer.from(matches[2], "base64");

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
