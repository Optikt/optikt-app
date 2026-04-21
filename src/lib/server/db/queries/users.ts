import { eq, or, and, isNull, isNotNull, count } from 'drizzle-orm';
import { UserRole } from '$lib/shared/enums';
import { db } from '$lib/server/db';
import { users, type User, type NewUser } from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';

/**
 * Find a user by their email or username (case-insensitive)
 */
export async function findUserByIdentifier(identifier: string): Promise<User | null> {
	const lowercased = identifier.toLowerCase();

	const [user] = await db
		.select()
		.from(users)
		.where(or(eq(users.email, lowercased), eq(users.username, lowercased)));

	return user ?? null;
}

/**
 * Find a user by their ID
 */
export async function findUserById(id: string): Promise<User | null> {
	const [user] = await db.select().from(users).where(eq(users.id, id));
	return user ?? null;
}

/**
 * Find a user by their email (excludes soft-deleted users)
 */
export async function findUserByEmail(email: string): Promise<User | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)));
	return user ?? null;
}

/**
 * Find a user by their username (excludes soft-deleted users)
 */
export async function findUserByUsername(username: string): Promise<User | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(and(eq(users.username, username.toLowerCase()), isNull(users.deletedAt)));
	return user ?? null;
}

/**
 * Find a DELETED user by their email
 */
export async function findDeletedUserByEmail(email: string): Promise<User | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(and(eq(users.email, email.toLowerCase()), isNotNull(users.deletedAt)));
	return user ?? null;
}

/**
 * Find a DELETED user by their username
 */
export async function findDeletedUserByUsername(username: string): Promise<User | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(and(eq(users.username, username.toLowerCase()), isNotNull(users.deletedAt)));
	return user ?? null;
}

/**
 * Create a new user
 */
export async function createUser(data: NewUser): Promise<User> {
	const now = nowISO();
	const [user] = await db
		.insert(users)
		.values({
			...data,
			id: crypto.randomUUID(),
			email: data.email.toLowerCase(),
			username: data.username.toLowerCase(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return user;
}

/**
 * Update a user by ID
 */
export async function updateUser(
	id: string,
	data: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<User> {
	const [user] = await db
		.update(users)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(users.id, id))
		.returning();
	return user;
}

/**
 * Soft delete a user by ID
 */
export async function deleteUser(id: string): Promise<boolean> {
	const result = await db
		.update(users)
		.set({
			deletedAt: nowISO(),
			isActive: false,
			updatedAt: nowISO()
		})
		.where(eq(users.id, id));
	return result.count > 0;
}

/**
 * Count active (non-deleted) users with ADMIN role
 */
export async function countActiveAdmins(): Promise<number> {
	const [result] = await db
		.select({ count: count() })
		.from(users)
		.where(and(eq(users.role, UserRole.ADMIN), isNull(users.deletedAt)));
	return result.count;
}

/**
 * Restore a soft-deleted user with new data
 */
export async function restoreUser(
	id: string,
	data: Partial<Omit<User, 'id' | 'createdAt' | 'deletedAt'>>
): Promise<User> {
	const [user] = await db
		.update(users)
		.set({
			...data,
			deletedAt: null,
			isActive: true,
			updatedAt: nowISO()
		})
		.where(eq(users.id, id))
		.returning();
	return user;
}
