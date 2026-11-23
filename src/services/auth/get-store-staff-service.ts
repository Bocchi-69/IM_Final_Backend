import { StoreRepository } from "@/repositories/store-repository";
import { UserRepository } from "@/repositories/user-repository";

export async function getStoreStaffService(code: string) {
  const storeRepo = new StoreRepository();
  const userRepo = new UserRepository();

  try {
    const store = await storeRepo.findByCode(code);
    if (!store) {
      return { code: 404, status: "error", message: "Store not found." };
    }

    const rawStaff = await userRepo.findStaffByStoreId(store.id);
    const staff = rawStaff.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
    }));

    return {
      code: 200,
      status: "success",
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
        type: store.type,
      },
      staff,
      data: {
        store: {
          id: store.id,
          name: store.name,
          code: store.code,
          type: store.type,
        },
        staff,
      },
    };
  } catch (error) {
    console.error("getStoreStaffService Error:", error);
    return { code: 500, status: "error", message: "Failed to retrieve store staff" };
  }
}
