import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";

export class StoreRepository {
  async findById(id: number) {
    const [store] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    return store;
  }

  async findByCode(code: string) {
    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.code, code.toUpperCase()))
      .limit(1);
    return store;
  }

  async create(data: { name: string; type: string; code: string }) {
    const [store] = await db.insert(stores).values(data).returning();
    return store;
  }
}
