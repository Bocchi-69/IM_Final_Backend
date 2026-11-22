import { ProductRepository } from "@/repositories/product-repository";
import { generateSku, generateUniqueBarcode } from "@/services/products/create-product-service";

export async function suggestProductCodesService(storeId: number, name?: string) {
  const repo = new ProductRepository();
  const productName = name?.trim() || "Item";

  try {
    const sku = await generateSku(repo, storeId, productName);
    const barcode = await generateUniqueBarcode(repo, storeId);

    return {
      code: 200,
      status: "success",
      data: {
        sku,
        barcode,
      },
    };
  } catch (error) {
    console.error("suggestProductCodesService Error:", error);
    return {
      code: 500,
      status: "error",
      message: "Failed to generate suggested product codes",
    };
  }
}
