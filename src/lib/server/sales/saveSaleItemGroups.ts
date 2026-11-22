import { db } from '$lib/server/db';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import {
	findSaleGroupableItems,
	findSaleItemGroups,
	lockSalePrimaryLens
} from '$lib/server/db/queries/sales/itemGroups';
import { auditService } from '$lib/server/audit';
import { hasChanges } from '$lib/server/audit/utils';
import { groupsAuditChanges, persistSaleGroups } from '$lib/server/sales/saleItemGroupsCore';
import { SaleStatus, canManageSaleByOwner } from '$lib/shared/enums';
import { validateItemGroups } from '$lib/shared/saleItemGroups';
import type { SaveSaleItemGroupsInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Groups-only save ("Organizar" from the detail / Personas tab when the sale
 * items are not editable). Allowed in every status except CANCELLED — it
 * touches no money and no inventory, so completed sales can still be
 * organized. Real sale item ids. A new primary lens creates a new current
 * prescription for the customer; unmarking deletes nothing.
 */
export async function saveSaleItemGroupsCore(data: SaveSaleItemGroupsInput, ctx: ActionContext) {
	const sale = await findSaleById(data.saleId);
	if (!sale) return { success: false as const, error: 'Venta no encontrada' };
	if (sale.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se puede organizar una venta cancelada' };
	}
	if (!canManageSaleByOwner(ctx.role, ctx.userId, sale.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	const lines = await findSaleGroupableItems(data.saleId);
	const errors = validateItemGroups(data.groups, lines, data.primaryLensItemId);
	if (errors.length > 0) return { success: false as const, error: errors[0] };

	const beforeGroups = await findSaleItemGroups(data.saleId);

	const { result, beforePrimary } = await db.transaction(async (tx) => {
		// Read the primary under a row lock: two concurrent saves must not both
		// see it as "changed" and create two current prescriptions.
		const lockedPrimary = await lockSalePrimaryLens(data.saleId, tx);
		const persisted = await persistSaleGroups(tx, {
			saleId: data.saleId,
			customerId: sale.customerId,
			groups: data.groups,
			primaryLensItemId: data.primaryLensItemId,
			previousPrimaryLensItemId: lockedPrimary
		});
		return { result: persisted, beforePrimary: lockedPrimary };
	});

	// Audit (best-effort, after the transaction)
	if (result.prescription) {
		await auditService.logCreate('prescription', result.prescription, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}
	const names = new Map(lines.map((l) => [l.id, l.snapshotName ?? 'Artículo']));
	const changes = groupsAuditChanges({
		before: beforeGroups,
		after: result.groups,
		beforePrimary,
		afterPrimary: result.primaryLensItemId,
		nameOf: (id) => names.get(id) ?? 'Artículo'
	});
	if (hasChanges(changes)) {
		await auditService.logCustom('sale', data.saleId, 'update', changes, ctx);
	}

	return {
		success: true as const,
		groups: result.groups ?? [],
		primaryLensItemId: result.primaryLensItemId ?? null,
		prescriptionCreated: !!result.prescription
	};
}
