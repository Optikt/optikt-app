import { describe, expect, it } from 'vitest';
import { createManualAdjustmentCmd, revertFullLotCmd } from './inventory.remote';
import { callRemote } from '$lib/testing/remoteHarness';
import { AdjustmentReason, InventoryMovementType } from '$lib/shared/enums';

describe('inventory remotes (Capa 3)', () => {
	it('createManualAdjustmentCmd rejects an unauthenticated caller with 401', async () => {
		await expect(
			callRemote(
				createManualAdjustmentCmd,
				{
					lotId: crypto.randomUUID(),
					adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
					quantity: 1,
					reason: AdjustmentReason.PHYSICAL_COUNT,
					notes: 'ajuste de prueba'
				},
				{ user: null }
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('revertFullLotCmd rejects an unauthenticated caller with 401', async () => {
		await expect(
			callRemote(revertFullLotCmd, { lotId: crypto.randomUUID() }, { user: null })
		).rejects.toMatchObject({ status: 401 });
	});
});
