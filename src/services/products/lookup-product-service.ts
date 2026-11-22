import { ProductRepository } from "@/repositories/product-repository";

export async function lookupProductService(storeId: number, code: string) {
  const productRepo = new ProductRepository();

  try {
    const product = await productRepo.lookup(storeId, code);
    if (!product) {
      return { code: 404, status: "error", message: "No product matches that code." };
    }

    return {
      code: 200,
      status: "success",
      data: product,
    };
  } catch (error) {
    console.error("lookupProductService Error:", error);
    return { code: 500, status: "error", message: "Failed to lookup product" };
  }
}
