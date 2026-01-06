import { eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, type User, type NewUser } from '$lib/server/db/schema';

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
 * Find a user by their email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
	const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
	return user ?? null;
}

/**
 * Find a user by their username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
	const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
	return user ?? null;
}

/**
 * Create a new user
 */
export async function createUser(data: NewUser): Promise<User> {
	const now = new Date();
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
		.set({ ...data, updatedAt: new Date() })
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
		.set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
		.where(eq(users.id, id));
	return result.count > 0;
}
