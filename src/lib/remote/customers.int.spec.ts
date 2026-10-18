import { beforeEach, describe, expect, it } from 'vitest';
import { createCustomerWithPrescription, updateCustomerForm } from './customers.remote';
import { callRemoteForm } from '$lib/testing/remoteHarness';
import { resetDb } from '$lib/testing/integration/db';
import { createCustomer, createUser } from '$lib/testing/integration/factories';
import { CustomerGender, UserRole } from '$lib/shared/enums';
import type { Customer } from '$lib/server/db/schema';

describe('customers remotes (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('creates a customer with optional birthDate and gender', async () => {
		const user = await createUser({ role: UserRole.ADMIN });

		const result = await callRemoteForm<
			Record<string, unknown>,
			{ success: boolean; entity: Customer }
		>(
			createCustomerWithPrescription,
			{
				firstName: 'Ana',
				lastName: 'Pérez',
				idNumber: 'V-11223344',
				birthDate: '2000-03-09',
				gender: CustomerGender.FEMENINO,
				primaryPhone: '+58 412 000 0000',
				email: ''
			},
			{ user }
		);

		expect(result.success).toBe(true);
		expect(result.entity.gender).toBe('FEMENINO');
		expect(result.entity.birthDate).toContain('2000-03-09');
	});

	it('updates gender and clears it with an empty string', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const existing = await createCustomer({ idNumber: 'V-99887766' });

		const updated = await callRemoteForm<Record<string, unknown>, Customer>(
			updateCustomerForm,
			{ id: existing.id, gender: CustomerGender.OTRO },
			{ user }
		);
		expect(updated.gender).toBe('OTRO');

		const cleared = await callRemoteForm<Record<string, unknown>, Customer>(
			updateCustomerForm,
			{ id: existing.id, gender: '' },
			{ user }
		);
		expect(cleared.gender).toBeNull();
	});
});
