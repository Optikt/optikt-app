/**
 * Sales remote — status transitions
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { query, command } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { SetSaleStatusSchema } from '$lib/schemas/sales';
import {
	findSaleById,
	updateSale as updateSaleQuery,
	getNextOrderNumber
} from '$lib/server/db/queries/sales';

import { db } from '$lib/server/db';
import { SaleStatus, UserRole, canManageSaleByOwner } from '$lib/shared/enums';

import { auditService, getAuditContext } from '$lib/server/audit';

import { nowISO } from '$lib/dates';
import { EmptySchema } from '$lib/schemas/common';

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

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
export const setSaleStatus = command(SetSaleStatusSchema, async (data) => {
	const user = requireAuth();
	const context = getAuditContext();

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

	if (!canManageSaleByOwner(user.role, user.id, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;
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
		{ ...context, reason: data.reason?.trim() || undefined },
		{ excludeFields: ['createdAt', 'updatedAt', 'deletedAt'] }
	);

	return { success: true as const, sale: updated };
});

// ============================================================================
// ORDER NUMBER
// ============================================================================

/**
 * Get the next suggested order number (MAX + 1).
 * Used to reset the create-sale form suggestion after a manual override.
 */
export const getNextOrderNumberCommand = query(EmptySchema, async (): Promise<number> => {
	requireAuth();
	return getNextOrderNumber();
});
