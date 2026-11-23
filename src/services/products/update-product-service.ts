import { ProductRepository } from "@/repositories/product-repository";
import type { UpdateProductInput } from "@/schema/product-schema";
import { saveBase64Image, downloadAndSaveImageUrl } from "@/utils/image-upload";

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
    } else if (typeof input.image === "string" && input.image.startsWith("http")) {
      const downloaded = await downloadAndSaveImageUrl(input.image);
      if (downloaded) imagePath = downloaded;
    } else if (input.image_url?.startsWith("http")) {
      const downloaded = await downloadAndSaveImageUrl(input.image_url);
      if (downloaded) imagePath = downloaded;
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
  } catch (error: any) {
    if (error?.code === "23505") {
      return { code: 422, status: "error", message: "A product with this SKU or barcode already exists." };
    }
    console.error("updateProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to update product" };
  }
}
