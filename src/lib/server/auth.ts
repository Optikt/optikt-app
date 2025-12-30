import type { RequestEvent } from '@sveltejs/kit';
import { eq, or, and } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	const token = encodeBase64url(bytes);
	return token;
}

export function getTokenHash(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export async function createSession(
	token: string,
	userId: string,
	options?: { ipAddress?: string; userAgent?: string }
) {
	const tokenHash = getTokenHash(token);
	const now = new Date();
	const session = {
		id: crypto.randomUUID(),
		userId,
		tokenHash,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30),
		isActive: true,
		ipAddress: options?.ipAddress ?? null,
		userAgent: options?.userAgent ?? null,
		createdAt: now,
		updatedAt: now
	};

	const [result] = await db.insert(table.userSessions).values(session).returning();
	return result;
}

export async function validateSessionToken(token: string) {
	const tokenHash = getTokenHash(token);

	const [result] = await db
		.select({
			user: {
				id: table.users.id,
				email: table.users.email,
				username: table.users.username,
				fullName: table.users.fullName,
				role: table.users.role,
				isActive: table.users.isActive,
				isSuperuser: table.users.isSuperuser
			},
			session: {
				id: table.userSessions.id,
				userId: table.userSessions.userId,
				tokenHash: table.userSessions.tokenHash,
				expiresAt: table.userSessions.expiresAt,
				isActive: table.userSessions.isActive
			}
		})
		.from(table.userSessions)
		.innerJoin(table.users, eq(table.userSessions.userId, table.users.id))
		.where(and(eq(table.userSessions.tokenHash, tokenHash), eq(table.userSessions.isActive, true)));

	if (!result) {
		return { session: null, user: null };
	}

	const { session, user } = result;

	// Check if user is active
	if (!user.isActive) {
		await db
			.update(table.userSessions)
			.set({ isActive: false })
			.where(eq(table.userSessions.id, session.id));
		return { session: null, user: null };
	}

	// Check if session expired
	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await db
			.update(table.userSessions)
			.set({ isActive: false })
			.where(eq(table.userSessions.id, session.id));
		return { session: null, user: null };
	}

	// Renew session if it's older than 15 days
	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		const newExpiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(table.userSessions)
			.set({ expiresAt: newExpiresAt, updatedAt: new Date() })
			.where(eq(table.userSessions.id, session.id));
		session.expiresAt = newExpiresAt;
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string) {
	await db
		.update(table.userSessions)
		.set({ isActive: false, updatedAt: new Date() })
		.where(eq(table.userSessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string) {
	await db
		.update(table.userSessions)
		.set({ isActive: false, updatedAt: new Date() })
		.where(eq(table.userSessions.userId, userId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, {
		path: '/'
	});
}

// Helper to find user by username or email (case-insensitive)
export async function findUserByIdentifier(identifier: string) {
	const lowercased = identifier.toLowerCase();

	const [user] = await db
		.select()
		.from(table.users)
		.where(or(eq(table.users.email, lowercased), eq(table.users.username, lowercased)));

	return user ?? null;
}
