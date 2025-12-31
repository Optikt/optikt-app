import type { RequestEvent } from '@sveltejs/kit';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import * as sessionQueries from '$lib/server/db/queries/sessions';
import * as userQueries from '$lib/server/db/queries/users';

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
	return await sessionQueries.createSession({
		userId,
		tokenHash,
		expiresAt: new Date(Date.now() + DAY_IN_MS * 30),
		ipAddress: options?.ipAddress,
		userAgent: options?.userAgent
	});
}

export async function validateSessionToken(token: string) {
	const tokenHash = getTokenHash(token);

	const result = await sessionQueries.findSessionByTokenHash(tokenHash);

	if (!result) {
		return { session: null, user: null };
	}

	const { session, user } = result;

	// Check if user is active
	if (!user.isActive) {
		await sessionQueries.deactivateSession(session.id);
		return { session: null, user: null };
	}

	// Check if session expired
	const sessionExpired = Date.now() >= session.expiresAt.getTime();
	if (sessionExpired) {
		await sessionQueries.deactivateSession(session.id);
		return { session: null, user: null };
	}

	// Renew session if it's older than 15 days
	const renewSession = Date.now() >= session.expiresAt.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		const newExpiresAt = new Date(Date.now() + DAY_IN_MS * 30);
		await sessionQueries.updateSessionExpiration(session.id, newExpiresAt);
		session.expiresAt = newExpiresAt;
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;

export async function invalidateSession(sessionId: string) {
	await sessionQueries.deactivateSession(sessionId);
}

export async function invalidateAllUserSessions(userId: string) {
	await sessionQueries.deactivateAllUserSessions(userId);
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: '/',
		httpOnly: true,
		secure: import.meta.env.PROD,
		sameSite: 'lax'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, {
		path: '/',
		secure: import.meta.env.PROD
	});
}

// Re-export user query for convenience
export const findUserByIdentifier = userQueries.findUserByIdentifier;
