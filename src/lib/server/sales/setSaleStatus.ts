import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { updateSale as updateSaleQuery } from '$lib/server/db/queries/sales/writes';
import { db } from '$lib/server/db';
import { SaleStatus, UserRole, canManageSaleByOwner } from '$lib/shared/enums';
import { auditService } from '$lib/server/audit';
import { nowISO } from '$lib/dates';
import type { SetSaleStatusInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

/** Forward order used to decide whether a transition goes backwards. */
const SALE_STATUS_FLOW: SaleStatus[] = [
	SaleStatus.PENDING,
	SaleStatus.IN_PROGRESS,
	SaleStatus.READY,
	SaleStatus.COMPLETED
];

/**
 * Set the sale status (manual transition, forward or backward).
 * - Forward transitions (toward COMPLETED): any user that can manage the sale.
 * - Backward transitions (reverting): ADMIN/MANAGER only.
 * - completedAt is set when entering COMPLETED and cleared when leaving it.
 */
export async function setSaleStatusCore(data: SetSaleStatusInput, ctx: ActionContext) {
	const existing = await findSaleById(data.id);
	if (!existing) return { success: false as const, error: 'Venta no encontrada' };

	const targetStatus = data.status as SaleStatus;

	if (existing.status === SaleStatus.CANCELLED) {
		return {
			success: false as const,
			error: 'No se puede cambiar el estado de una venta cancelada'
		};
	}

	if (existing.status === targetStatus) {
		return { success: false as const, error: 'La venta ya está en ese estado' };
	}

	if (!canManageSaleByOwner(ctx.role, ctx.userId, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	const isAdmin = ctx.role === UserRole.ADMIN || ctx.role === UserRole.MANAGER;
	const currentIndex = SALE_STATUS_FLOW.indexOf(existing.status as SaleStatus);
	const targetIndex = SALE_STATUS_FLOW.indexOf(targetStatus);
	const isBackward = targetIndex < currentIndex;
	if (isBackward && !isAdmin) {
		return {
			success: false as const,
			error: 'Solo administradores pueden revertir el estado de una venta'
		};
	}

	if (isBackward && !data.reason?.trim()) {
		return {
			success: false as const,
			error: 'El motivo es obligatorio para revertir el estado'
		};
	}

	const updated = await db.transaction(async (tx) => {
		return updateSaleQuery(
			data.id,
			{
				status: targetStatus,
				completedAt: targetStatus === SaleStatus.COMPLETED ? nowISO() : null
			},
			tx
		);
	});

	if (!updated) {
		return { success: false as const, error: 'Error al actualizar la venta' };
	}

	await auditService.logUpdate(
		'sale',
		data.id,
		existing,
		updated,
		{ ...ctx, reason: data.reason?.trim() || undefined },
		{ excludeFields: ['createdAt', 'updatedAt', 'deletedAt'] }
	);

	return { success: true as const, sale: updated };
}
