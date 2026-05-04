import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { getMovementsWithDetails } from '$lib/server/db/queries/inventoryMovements';
import { getActiveLensLotsFifo } from '$lib/server/db/queries/inventoryLots';
import { findLensCatalogItemByIdWithRelations } from '$lib/server/db/queries/lenses';
import { UserRole } from '$lib/shared/enums';
import { isValidUuid } from '$lib/utils/uuid';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

	if (!isValidUuid(params.id)) {
		error(404, 'Lente no encontrado');
	}

	const item = await findLensCatalogItemByIdWithRelations(params.id);

	if (!item) {
		error(404, 'Lente no encontrado');
	}

	if (item.inventoryMode !== 'STOCK') {
		error(400, 'Solo los lentes en modo STOCK pueden ajustarse manualmente');
	}

	const [activeLots, lensMovements] = await Promise.all([
		getActiveLensLotsFifo(item.id),
		getMovementsWithDetails({ lensCatalogItemId: item.id, limit: 10 })
	]);

	return {
		item,
		activeLots,
		fifoCost: activeLots[0]?.unitPurchasePrice ?? null,
		lensMovements
	};
};
