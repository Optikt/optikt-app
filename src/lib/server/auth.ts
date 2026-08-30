import type { RequestEvent } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { encodeBase64url } from '@oslojs/encoding';
import * as sessionQueries from '$lib/server/db/queries/sessions';
import * as userQueries from '$lib/server/db/queries/users';
import { dev } from '$app/environment';
import { fromISO, toUTCString, daysFromNow } from '$lib/dates';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = 'auth-session';

export function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	const token = encodeBase64url(bytes);
	return token;
}

export function getTokenHash(token: string): string {
	return createHash('sha256').update(token).digest('hex');
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
		expiresAt: toUTCString(daysFromNow(30)),
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

	// Check if user is deactivated
	if (user.deactivatedAt) {
		await sessionQueries.deactivateSession(session.id);
		return { session: null, user: null };
	}

	// Check if session expired
	const sessionExpired = Date.now() >= fromISO(session.expiresAt).getTime();
	if (sessionExpired) {
		await sessionQueries.deactivateSession(session.id);
		return { session: null, user: null };
	}

	// Renew session if it's older than 15 days
	const renewSession = Date.now() >= fromISO(session.expiresAt).getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		const newExpiresAt = toUTCString(daysFromNow(30));
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

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: string) {
	event.cookies.set(sessionCookieName, token, {
		expires: fromISO(expiresAt),
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, {
		path: '/',
		secure: !dev
	});
}

// Re-export user query for convenience
export const findUserByIdentifier = userQueries.findUserByIdentifier;
