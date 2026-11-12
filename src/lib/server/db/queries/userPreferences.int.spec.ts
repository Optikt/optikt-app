import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '$lib/testing/integration/db';
import { createUser } from '$lib/testing/integration/factories';
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
