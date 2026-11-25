import { db } from '$lib/server/db';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import {
	findSaleGroupableItems,
	findSaleItemGroups,
	lockSaleForGroups
} from '$lib/server/db/queries/sales/itemGroups';
import { auditService } from '$lib/server/audit';
import { hasChanges } from '$lib/server/audit/utils';
import {
	groupsAuditChanges,
	persistSaleGroups,
	type PersistSaleGroupsResult
} from '$lib/server/sales/saleItemGroupsCore';
import { SaleStatus } from '$lib/shared/enums/salesTypes';
import { canManageSaleByOwner } from '$lib/shared/enums/roles';
import { validateItemGroups } from '$lib/shared/saleItemGroups';
import type { SaveSaleItemGroupsInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

class SaleGroupsSaveError extends Error {}

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

	let lines: Awaited<ReturnType<typeof findSaleGroupableItems>> = [];
	let beforeGroups: Awaited<ReturnType<typeof findSaleItemGroups>> = [];
	let beforePrimary: string | null = null;
	let result!: PersistSaleGroupsResult;

	try {
		await db.transaction(async (tx) => {
			// Lock the sale row: concurrent saves, cancellations, or item edits
			// serialize here so status, customer, lines, and primary stay consistent.
			const locked = await lockSaleForGroups(data.saleId, tx);
			if (!locked) throw new SaleGroupsSaveError('Venta no encontrada');
			if (locked.status === SaleStatus.CANCELLED) {
				throw new SaleGroupsSaveError('No se puede organizar una venta cancelada');
			}

			[lines, beforeGroups] = await Promise.all([
				findSaleGroupableItems(data.saleId, tx),
				findSaleItemGroups(data.saleId, tx)
			]);
			const errors = validateItemGroups(data.groups, lines, data.primaryLensItemId);
			if (errors.length > 0) throw new SaleGroupsSaveError(errors[0]);

			beforePrimary = locked.primaryLensItemId;
			result = await persistSaleGroups(tx, {
				saleId: data.saleId,
				customerId: locked.customerId,
				groups: data.groups,
				primaryLensItemId: data.primaryLensItemId,
				previousPrimaryLensItemId: locked.primaryLensItemId
			});
		});
	} catch (error) {
		if (error instanceof SaleGroupsSaveError) {
			return { success: false as const, error: error.message };
		}
		throw error;
	}

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
