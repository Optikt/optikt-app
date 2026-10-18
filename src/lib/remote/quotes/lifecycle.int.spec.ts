import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { assignQuoteCustomer } from './lifecycle.remote';
import { callRemote } from '$lib/testing/remoteHarness';
import { resetDb } from '$lib/testing/integration/db';
import { createQuote, createUser } from '$lib/testing/integration/factories';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { CustomerGender, UserRole } from '$lib/shared/enums';

describe('quotes lifecycle remotes (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('assigns a new inline customer with birthDate and gender', async () => {
		const user = await createUser({ role: UserRole.SELLER });
		const quote = await createQuote();

		const result = (await callRemote(
			assignQuoteCustomer,
			{
				id: quote.id,
				newCustomer: {
					firstName: 'Ana',
					lastName: 'Pérez',
					idNumber: 'V-55443322',
					birthDate: '1990-05-01',
					gender: CustomerGender.OTRO
				}
			},
			{ user }
		)) as { success: boolean; error?: string };

		expect(result).toEqual({ success: true });

		const [created] = await db.select().from(customers).where(eq(customers.idNumber, 'V-55443322'));
		expect(created.gender).toBe('OTRO');
		expect(created.birthDate).toContain('1990-05-01');
	});
});
