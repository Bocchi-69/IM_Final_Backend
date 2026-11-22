import { ProductRepository } from "@/repositories/product-repository";

export async function getProductsService(storeId: number, query?: string) {
  const productRepo = new ProductRepository();

  try {
    const list = await productRepo.findAllByStore(storeId, query);
    return {
      code: 200,
      status: "success",
      data: list,
    };
  } catch (error) {
    console.error("getProductsService Error:", error);
    return { code: 500, status: "error", message: "Failed to load products" };
  }
}
