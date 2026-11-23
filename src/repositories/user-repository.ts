import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, stores } from "@/db/schema";

export class UserRepository {
  async findById(id: number) {
    const result = await db
      .select({
        id: users.id,
        storeId: users.storeId,
        name: users.name,
        email: users.email,
        role: users.role,
        failedPinAttempts: users.failedPinAttempts,
        pinLockedUntil: users.pinLockedUntil,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        store: {
          id: stores.id,
          name: stores.name,
          code: stores.code,
          type: stores.type,
        },
      })
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .where(eq(users.id, id))
      .limit(1);

    return result[0];
  }

  async findByEmail(email: string) {
    const result = await db
      .select({
        id: users.id,
        storeId: users.storeId,
        name: users.name,
        email: users.email,
        password: users.password,
        pin: users.pin,
        role: users.role,
        failedPinAttempts: users.failedPinAttempts,
        pinLockedUntil: users.pinLockedUntil,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        store: {
          id: stores.id,
          name: stores.name,
          code: stores.code,
          type: stores.type,
        },
      })
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  async findByIdAndStore(userId: number, storeId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.storeId, storeId)))
      .limit(1);
    return user;
  }

  async findStaffByStoreId(storeId: number) {
    return db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.storeId, storeId))
      .orderBy(asc(users.id));
  }

  async create(data: {
    storeId: number;
    name: string;
    email?: string | null;
    password?: string | null;
    pin?: string | null;
    role?: string;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        storeId: data.storeId,
        name: data.name,
        email: data.email ?? null,
        password: data.password ?? null,
        pin: data.pin ?? null,
        role: data.role ?? "employee",
      })
      .returning();
    return user;
  }

  async updatePin(id: number, hashedPin: string) {
    const [user] = await db
      .update(users)
      .set({
        pin: hashedPin,
        failedPinAttempts: 0,
        pinLockedUntil: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
      });
    return user;
  }

  async incrementFailedPin(id: number, _currentAttempts?: number) {
    const [user] = await db
      .update(users)
      .set({
        pinLockedUntil: sql`CASE WHEN ${users.failedPinAttempts} + 1 >= 3 THEN NOW() + INTERVAL '15 minutes' ELSE ${users.pinLockedUntil} END`,
        failedPinAttempts: sql`CASE WHEN ${users.failedPinAttempts} + 1 >= 3 THEN 0 ELSE ${users.failedPinAttempts} + 1 END`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(users.id, id))
      .returning();

    const isLocked = Boolean(user?.pinLockedUntil && new Date(user.pinLockedUntil) > new Date());
    const attempts = isLocked ? 3 : (user?.failedPinAttempts ?? 1);

    return { user, locked: isLocked, attempts };
  }

  async resetFailedPin(id: number) {
    await db
      .update(users)
      .set({
        failedPinAttempts: 0,
        pinLockedUntil: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  async deleteStaff(id: number, storeId: number) {
    const [deleted] = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.storeId, storeId), eq(users.role, "employee")))
      .returning();
    return deleted;
  }
}
