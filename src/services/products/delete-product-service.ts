import { ProductRepository } from "@/repositories/product-repository";

export async function deleteProductService(productId: number, storeId: number) {
  const productRepo = new ProductRepository();

  try {
    const existing = await productRepo.findById(productId, storeId);
    if (!existing) {
      return { code: 404, status: "error", message: "Product not found" };
    }

    await productRepo.softDelete(productId, storeId);

    return {
      code: 204,
      status: "success",
      message: "Product deleted successfully",
    };
  } catch (error) {
    console.error("deleteProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to delete product" };
  }
}
