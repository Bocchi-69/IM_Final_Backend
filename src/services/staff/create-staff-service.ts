import bcrypt from "bcrypt";
import { UserRepository } from "@/repositories/user-repository";
import type { CreateStaffInput } from "@/schema/staff-schema";

export async function createStaffService(storeId: number, input: CreateStaffInput) {
  const userRepo = new UserRepository();

  try {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return { code: 422, status: "error", message: "Staff name is required." };
    }

    // 1. Check if staff or owner with the same name already exists in this store
    const existingByName = await userRepo.findByNameAndStore(trimmedName, storeId);
    if (existingByName) {
      return {
        code: 422,
        status: "error",
        message: "A staff member with this name already exists in your store.",
      };
    }

    // 2. Check if another user in this store already uses the same PIN
    const existingUsersWithPin = await userRepo.findUsersWithPinByStore(storeId);
    for (const user of existingUsersWithPin) {
      if (user.pin && (await bcrypt.compare(input.pin, user.pin))) {
        return {
          code: 422,
          status: "error",
          message: "This PIN is already in use by another staff member. Please choose a different PIN.",
        };
      }
    }

    const hashedPin = await bcrypt.hash(input.pin, 10);
    const staff = await userRepo.create({
      storeId,
      name: trimmedName,
      pin: hashedPin,
      role: "employee",
    });

    return {
      code: 201,
      status: "success",
      message: "Staff member added successfully",
      data: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
      },
    };
  } catch (error: any) {
    if (error?.code === "23505" || error?.constraint?.includes("users_store_name")) {
      return {
        code: 422,
        status: "error",
        message: "A staff member with this name already exists in your store.",
      };
    }
    console.error("createStaffService Error:", error);
    return { code: 500, status: "error", message: "Failed to add staff member" };
  }
}
