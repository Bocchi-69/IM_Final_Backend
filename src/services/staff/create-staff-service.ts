import bcrypt from "bcrypt";
import { UserRepository } from "@/repositories/user-repository";
import type { CreateStaffInput } from "@/schema/staff-schema";

export async function createStaffService(storeId: number, input: CreateStaffInput) {
  const userRepo = new UserRepository();

  try {
    const hashedPin = await bcrypt.hash(input.pin, 10);
    const staff = await userRepo.create({
      storeId,
      name: input.name,
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
  } catch (error) {
    console.error("createStaffService Error:", error);
    return { code: 500, status: "error", message: "Failed to add staff member" };
  }
}
