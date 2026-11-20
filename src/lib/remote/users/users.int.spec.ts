import { beforeEach, describe, expect, it } from 'vitest';
import { updateUserForm } from './forms.remote';
import { reactivateUser, updateUser } from './commands.remote';
import { callRemote, callRemoteForm } from '$lib/testing/remoteHarness';
import { resetDb } from '$lib/testing/integration/db';
import { createUser } from '$lib/testing/integration/factories';
import { createSession, getUserActiveSessions } from '$lib/server/db/queries/sessions';
import { UserRole } from '$lib/shared/enums/roles';
import { nowISO } from '$lib/dates';

const inThirtyDays = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

async function seedSessions(userId: string, count: number) {
	for (let i = 0; i < count; i++) {
		await createSession({
			userId,
			tokenHash: `hash-${userId}-${i}`,
			expiresAt: inThirtyDays()
		});
	}
}

describe('users remotes — cambio de clave por admin invalida sesiones', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('updateUserForm con password desactiva TODAS las sesiones del usuario objetivo', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const target = await createUser({ role: UserRole.SELLER });
		await seedSessions(target.id, 2);
		await seedSessions(admin.id, 1);

		await callRemoteForm(
			updateUserForm,
			{ id: target.id, role: UserRole.SELLER, password: 'clave-nueva-456' },
			{ user: admin }
		);

		expect(await getUserActiveSessions(target.id)).toHaveLength(0);
		// The admin's own session is untouched
		expect(await getUserActiveSessions(admin.id)).toHaveLength(1);
	});

	it('updateUserForm sin password no toca las sesiones', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const target = await createUser({ role: UserRole.SELLER });
		await seedSessions(target.id, 2);

		await callRemoteForm(
			updateUserForm,
			{ id: target.id, role: UserRole.SELLER, fullName: 'Nombre Nuevo', password: '' },
			{ user: admin }
		);

		expect(await getUserActiveSessions(target.id)).toHaveLength(2);
	});

	it('updateUser (command) con password desactiva todas las sesiones del objetivo', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const target = await createUser({ role: UserRole.SELLER });
		await seedSessions(target.id, 3);

		await callRemote(
			updateUser,
			{ id: target.id, role: UserRole.SELLER, password: 'clave-nueva-456' },
			{ user: admin }
		);

		expect(await getUserActiveSessions(target.id)).toHaveLength(0);
	});

	it('reactivateUser corta las sesiones que quedaron de antes del borrado', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const deleted = await createUser({ role: UserRole.SELLER, deletedAt: nowISO() });
		await seedSessions(deleted.id, 2);

		await callRemote(
			reactivateUser,
			{
				deletedUserId: deleted.id,
				email: `re-${deleted.id.slice(0, 8)}@optikt.test`,
				username: `re-${deleted.id.slice(0, 8)}`,
				fullName: 'Reactivado',
				password: 'clave-nueva-456',
				role: UserRole.SELLER
			},
			{ user: admin }
		);

		expect(await getUserActiveSessions(deleted.id)).toHaveLength(0);
	});
});
