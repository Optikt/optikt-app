import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userSessions, users, type Session } from '$lib/server/db/schema';

// Session validation result type
export type SessionWithUser = {
	session: {
		id: string;
		userId: string;
		tokenHash: string;
		expiresAt: Date;
		isActive: boolean;
	};
	user: {
		id: string;
		email: string;
		username: string;
		fullName: string;
		role: string;
		isActive: boolean;
		isSuperuser: boolean;
	};
};

/**
 * Find a session by its token hash with user data
 */
export async function findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
	const [result] = await db
		.select({
			user: {
				id: users.id,
				email: users.email,
				username: users.username,
				fullName: users.fullName,
				role: users.role,
				isActive: users.isActive,
				isSuperuser: users.isSuperuser
			},
			session: {
				id: userSessions.id,
				userId: userSessions.userId,
				tokenHash: userSessions.tokenHash,
				expiresAt: userSessions.expiresAt,
				isActive: userSessions.isActive
			}
		})
		.from(userSessions)
		.innerJoin(users, eq(userSessions.userId, users.id))
		.where(and(eq(userSessions.tokenHash, tokenHash), eq(userSessions.isActive, true)));

	return result ?? null;
}

/**
 * Create a new session
 */
export async function createSession(data: {
	userId: string;
	tokenHash: string;
	expiresAt: Date;
	ipAddress?: string | null;
	userAgent?: string | null;
}): Promise<Session> {
	const now = new Date();
	const [session] = await db
		.insert(userSessions)
		.values({
			id: crypto.randomUUID(),
			userId: data.userId,
			tokenHash: data.tokenHash,
			expiresAt: data.expiresAt,
			isActive: true,
			ipAddress: data.ipAddress ?? null,
			userAgent: data.userAgent ?? null,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return session;
}

/**
 * Update session expiration
 */
export async function updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
	await db
		.update(userSessions)
		.set({ expiresAt, updatedAt: new Date() })
		.where(eq(userSessions.id, sessionId));
}

/**
 * Deactivate a session by ID
 */
export async function deactivateSession(sessionId: string): Promise<void> {
	await db
		.update(userSessions)
		.set({ isActive: false, updatedAt: new Date() })
		.where(eq(userSessions.id, sessionId));
}

/**
 * Deactivate all sessions for a user
 */
export async function deactivateAllUserSessions(userId: string): Promise<void> {
	await db
		.update(userSessions)
		.set({ isActive: false, updatedAt: new Date() })
		.where(eq(userSessions.userId, userId));
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<Session[]> {
	return await db
		.select()
		.from(userSessions)
		.where(and(eq(userSessions.userId, userId), eq(userSessions.isActive, true)));
}
