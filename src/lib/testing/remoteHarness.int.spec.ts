import { beforeEach, describe, expect, it } from 'vitest';
import { listBrands } from '$lib/remote/brands.remote';
import type { Brand } from '$lib/server/db/schema';
import type { PaginatedResult } from '$lib/types';
import { UserRole } from '$lib/shared/enums';
import { resetDb } from './integration/db';
import { createBrand, createUser } from './integration/factories';
import { callRemote } from './remoteHarness';

describe('remote harness (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('invokes a real query remote function with request context', async () => {
		const user = await createUser();
		const result = await callRemote<Record<string, never>, PaginatedResult<Brand>>(
			listBrands,
			{},
			{ user, method: 'GET' }
		);

		expect(result.items).toEqual([]);
		expect(result.total).toBe(0);
	});

	it('returns rows seeded through factories', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		await createBrand({ name: 'Ray-Ban IT' });

		const result = await callRemote<Record<string, never>, PaginatedResult<Brand>>(
			listBrands,
			{},
			{ user, method: 'GET' }
		);

		expect(result.items.map((brand) => brand.name)).toContain('Ray-Ban IT');
	});
});
