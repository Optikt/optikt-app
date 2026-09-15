import { describe, expect, it } from 'vitest';
import { cancelSale } from './lifecycle.remote';
import { updateSale } from './update.remote';
import { callRemote } from '$lib/testing/remoteHarness';
import { RefundStatus } from '$lib/shared/enums';
import type { CancelSaleInput, UpdateSaleInput } from '$lib/schemas/sales';

describe('sales lifecycle remotes (Capa 3)', () => {
	it('cancelSale rejects an unauthenticated caller with 401', async () => {
		const input: CancelSaleInput = {
			id: crypto.randomUUID(),
			reason: 'Motivo de cancelación de prueba',
			refundStatus: RefundStatus.RETAINED,
			refundNotes: 'Nota de retención de prueba'
		};

		await expect(callRemote(cancelSale, input, { user: null })).rejects.toMatchObject({
			status: 401
		});
	});

	it('updateSale rejects an unauthenticated caller with 401', async () => {
		const input: UpdateSaleInput = { id: crypto.randomUUID(), reason: 'ajuste' };

		await expect(callRemote(updateSale, input, { user: null })).rejects.toMatchObject({
			status: 401
		});
	});
});
