/**
 * Purchase orders remote — ready/review/cancel lifecycle
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { PriceSuggestion } from './shared';
import { getPurchaseOrderReadinessIssues } from './shared';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';

import {
	ConfirmPurchaseOrderSchema,
	CancelPurchaseOrderSchema,
	MarkPurchaseOrderReadySchema,
	TogglePurchaseOrderItemReviewedSchema
} from '$lib/schemas/purchaseOrders';

import {
	findPurchaseOrderById,
	getPurchaseOrderItems,
	setPurchaseOrderReadyForReview,
	setPurchaseOrderItemReviewed,
	findPurchaseOrderItemById,
	confirmPurchaseOrder as confirmPO,
	cancelPurchaseOrder as cancelPO
} from '$lib/server/db/queries/purchaseOrders';

import { findProductById } from '$lib/server/db/queries/products';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus } from '$lib/shared/enums';

import { auditService, getAuditContext } from '$lib/server/audit';

export const markPurchaseOrderReadyCmd = command(MarkPurchaseOrderReadySchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo los borradores pueden marcarse como listos' };
	}

	const issues = await getPurchaseOrderReadinessIssues(data.id);
	if (issues.length > 0) {
		return {
			success: false as const,
			error: `Completa el borrador antes de marcarlo como listo: ${issues.join(', ')}`
		};
	}

	try {
		const updated = await db.transaction(async (tx) =>
			setPurchaseOrderReadyForReview(data.id, true, tx, data.clearReviewed)
		);
		await auditService.logUpdate('purchase_order', data.id, existing, updated, context);
		return { success: true as const, purchaseOrder: updated };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error marcando orden como lista')
		};
	}
});

export const unmarkPurchaseOrderReadyCmd = command(MarkPurchaseOrderReadySchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo los borradores pueden volver a edición' };
	}

	try {
		const updated = await db.transaction(async (tx) =>
			setPurchaseOrderReadyForReview(data.id, false, tx, true)
		);
		await auditService.logUpdate('purchase_order', data.id, existing, updated, context);
		return { success: true as const, purchaseOrder: updated };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error devolviendo orden a edición')
		};
	}
});

export const togglePurchaseOrderItemReviewedCmd = command(
	TogglePurchaseOrderItemReviewedSchema,
	async (data) => {
		requireAdmin();

		const context = getAuditContext();
		try {
			const item = await findPurchaseOrderItemById(data.id);
			if (!item) {
				return { success: false as const, error: 'Ítem no encontrado' };
			}
			const parent = await findPurchaseOrderById(item.purchaseOrderId);
			if (!parent) {
				return { success: false as const, error: 'Orden de compra no encontrada' };
			}
			if (parent.status !== PurchaseOrderStatus.DRAFT) {
				return {
					success: false as const,
					error: 'Solo se pueden marcar líneas en órdenes en borrador'
				};
			}

			const updated = await setPurchaseOrderItemReviewed(data.id, data.value);
			await auditService.logUpdate('purchase_order_item', data.id, item, updated, context);
			return { success: true as const, item: updated };
		} catch (e) {
			return {
				success: false as const,
				error: getErrorMessage(e, 'Error actualizando línea')
			};
		}
	}
);

export const confirmPurchaseOrderCmd = command(ConfirmPurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado', priceSuggestions: [] };
	}

	try {
		const result = await db.transaction(async (tx) => {
			return confirmPO(data.id, context.userId!, tx);
		});

		await auditService.logUpdate(
			'purchase_order',
			data.id,
			{ status: PurchaseOrderStatus.DRAFT },
			{ status: PurchaseOrderStatus.CONFIRMED },
			context
		);

		// Collect price suggestions: compare PO item sale prices vs current product sale prices
		const poItems = await getPurchaseOrderItems(data.id);
		const suggestions: PriceSuggestion[] = [];

		for (const item of poItems) {
			if (!item.productId) continue;
			const product = await findProductById(item.productId);
			if (!product) continue;

			const current = product.currentSalePrice;
			const suggested = item.unitSalePrice;

			// Suggest only when PO price differs from current
			if (current === null || Number(current) !== Number(suggested)) {
				suggestions.push({
					productId: product.id,
					productName: product.name,
					productSku: product.sku,
					currentSalePrice: current !== null ? Number(current) : null,
					suggestedSalePrice: Number(suggested)
				});
			}
		}

		return { success: true as const, purchaseOrder: result, priceSuggestions: suggestions };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error confirmando orden de compra'),
			priceSuggestions: []
		};
	}
});

export const cancelPurchaseOrderCmd = command(CancelPurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	try {
		const result = await cancelPO(data.id);

		await auditService.logUpdate(
			'purchase_order',
			data.id,
			{ status: PurchaseOrderStatus.DRAFT },
			{ status: PurchaseOrderStatus.CANCELLED },
			context
		);

		return { success: true as const, purchaseOrder: result };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error cancelando orden de compra')
		};
	}
});
