import { beforeEach, describe, expect, it } from 'vitest';
import { hash, verify } from '@node-rs/argon2';
import { changePasswordForm } from './profile.remote';
import { callRemoteForm } from '$lib/testing/remoteHarness';
import { resetDb } from '$lib/testing/integration/db';
import { createUser } from '$lib/testing/integration/factories';
import { createSession, getUserActiveSessions } from '$lib/server/db/queries/sessions';
import { findUserById } from '$lib/server/db/queries/users';
import { UserRole } from '$lib/shared/enums/roles';

const inThirtyDays = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

describe('changePasswordForm — invalida las otras sesiones (users)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('desactiva las demás sesiones del usuario y conserva la actual', async () => {
		const user = await createUser({
			role: UserRole.SELLER,
			hashedPassword: await hash('clave-actual-123')
		});
		const otherUser = await createUser();
		const current = await createSession({
			userId: user.id,
			tokenHash: 'hash-current',
			expiresAt: inThirtyDays()
		});
		const other = await createSession({
			userId: user.id,
			tokenHash: 'hash-other',
			expiresAt: inThirtyDays()
		});
		const foreign = await createSession({
			userId: otherUser.id,
			tokenHash: 'hash-foreign',
			expiresAt: inThirtyDays()
		});

		const result = await callRemoteForm<Record<string, unknown>, { success: boolean }>(
			changePasswordForm,
			{
				currentPassword: 'clave-actual-123',
				newPassword: 'clave-nueva-456',
				confirmPassword: 'clave-nueva-456'
			},
			{ user, session: current }
		);
		expect(result.success).toBe(true);

		const active = await getUserActiveSessions(user.id);
		expect(active.map((s) => s.id)).toEqual([current.id]);
		expect(active.some((s) => s.id === other.id)).toBe(false);

		// Sessions of other users are untouched
		const foreignActive = await getUserActiveSessions(otherUser.id);
		expect(foreignActive.map((s) => s.id)).toEqual([foreign.id]);

		const updated = await findUserById(user.id);
		expect(await verify(updated!.hashedPassword, 'clave-nueva-456')).toBe(true);
	});

	it('no toca sesiones si la contraseña actual es incorrecta', async () => {
		const user = await createUser({ hashedPassword: await hash('clave-actual-123') });
		const current = await createSession({
			userId: user.id,
			tokenHash: 'hash-current-2',
			expiresAt: inThirtyDays()
		});
		await createSession({ userId: user.id, tokenHash: 'hash-other-2', expiresAt: inThirtyDays() });

		await expect(
			callRemoteForm(
				changePasswordForm,
				{
					currentPassword: 'equivocada',
					newPassword: 'clave-nueva-456',
					confirmPassword: 'clave-nueva-456'
				},
				{ user, session: current }
			)
		).rejects.toThrow();

		expect(await getUserActiveSessions(user.id)).toHaveLength(2);
	});
});
