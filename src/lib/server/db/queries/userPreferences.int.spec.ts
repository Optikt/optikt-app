import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '$lib/testing/integration/db';
import { createUser } from '$lib/testing/integration/factories';
import { callRemote } from '$lib/testing/remoteHarness';
import { saveUserPreference } from '$lib/remote/users/preferences.remote';
import { UserRole } from '$lib/shared/enums';
import { getUserPreference, setUserPreference } from './userPreferences';

describe('userPreferences', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('devuelve null cuando la preferencia no existe', async () => {
		const user = await createUser();
		expect(await getUserPreference(user.id, 'sales.view')).toBeNull();
	});

	it('guarda y lee una preferencia (roundtrip)', async () => {
		const user = await createUser();

		await setUserPreference(user.id, 'sales.view', 'grid');

		expect(await getUserPreference(user.id, 'sales.view')).toBe('grid');
	});

	it('el upsert sobreescribe el valor anterior', async () => {
		const user = await createUser();

		await setUserPreference(user.id, 'sales.view', 'list');
		await setUserPreference(user.id, 'sales.view', 'grid');

		expect(await getUserPreference(user.id, 'sales.view')).toBe('grid');
	});

	it('las preferencias de un usuario no afectan a otro', async () => {
		const alice = await createUser({ fullName: 'Alice' });
		const bob = await createUser({ fullName: 'Bob' });

		await setUserPreference(alice.id, 'sales.view', 'grid');

		expect(await getUserPreference(bob.id, 'sales.view')).toBeNull();
		expect(await getUserPreference(alice.id, 'sales.view')).toBe('grid');
	});
});

describe('saveUserPreference (remote)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('exige sesión (401 sin usuario)', async () => {
		await expect(
			callRemote(saveUserPreference, { key: 'sales.view', value: 'grid' }, { user: null })
		).rejects.toMatchObject({ status: 401 });
	});

	it('guarda la preferencia del usuario autenticado', async () => {
		const dbUser = await createUser({ role: UserRole.SELLER });

		await callRemote(
			saveUserPreference,
			{ key: 'sales.view', value: 'grid' },
			{ user: { id: dbUser.id, role: dbUser.role } }
		);

		expect(await getUserPreference(dbUser.id, 'sales.view')).toBe('grid');
	});
});
