import { beforeEach, describe, expect, it } from 'vitest';
import { applySession } from './sessions';
import { resetDb } from '$lib/testing/integration/db';
import {
	createInventoryCountLine,
	createInventoryCountSession,
	createUser
} from '$lib/testing/integration/factories';
import { UserRole } from '$lib/shared/enums';

describe('applyInventoryCountSession', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('applies an open, fully counted session and records the counters', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			systemStock: 10,
			countedStock: 12,
			difference: 2
		});
		await createInventoryCountLine({
			sessionId: session.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});

		const result = await applySession(session.id, admin.id);

		expect(result.status).toBe('APPLIED');
		expect(result.totalItemsCounted).toBe(2);
		expect(result.totalAdjustmentsIn).toBe(1);
		expect(result.totalAdjustmentsOut).toBe(0);
		expect(result.totalMatches).toBe(1);
	});

	it('rejects a user without ADMIN/MANAGER role', async () => {
		const seller = await createUser({ role: UserRole.SELLER });
		const session = await createInventoryCountSession();
		await createInventoryCountLine({ sessionId: session.id });

		await expect(applySession(session.id, seller.id)).rejects.toThrow('Solo ADMIN o MANAGER');
	});

	it('rejects a session with uncounted lines', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			countedStock: null,
			difference: null
		});

		await expect(applySession(session.id, admin.id)).rejects.toThrow(
			'Debes contar o confirmar todos los ítems'
		);
	});

	it('rejects a session that is no longer open', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const session = await createInventoryCountSession({
			openedById: admin.id,
			status: 'APPLIED'
		});

		await expect(applySession(session.id, admin.id)).rejects.toThrow(
			'La sesión ya no está abierta'
		);
	});

	it('rejects an unknown user', async () => {
		const session = await createInventoryCountSession();

		await expect(applySession(session.id, crypto.randomUUID())).rejects.toThrow(
			'Usuario no encontrado'
		);
	});
});
