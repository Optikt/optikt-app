/**
 * Pure helper functions for the purchase order detail page.
 * No side effects, no reactive state — just formatting, classification, and display logic.
 */

import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
import type { InventoryLot, InventoryMovement } from '$lib/server/db/schema';
import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import {
	createPurchaseOrderDraftItemFromExisting,
	calculateDraftItemTotalAlt
} from '$lib/components/purchases/purchaseOrderDraft';
import { getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
import { getPurchaseOrderItemTypeLabel, PurchaseDocumentType } from '$lib/shared/enums';

// =============================================================================
// Types
// =============================================================================

export interface AuditEvent {
	id: string;
	label: string;
	changedByName: string | null;
	changedAt: string;
	entityType: string;
	action: string;
}

export type ItemReviewFilter = 'all' | 'reviewed' | 'pending';

// =============================================================================
// Constants
// =============================================================================

export const PO_STATUS_LABELS: Record<string, string> = {
	CONFIRMED: 'Orden confirmada',
	CANCELLED: 'Orden cancelada',
	DRAFT: 'Orden devuelta a borrador'
};

export const ITEM_REVIEW_FILTER_OPTIONS: { value: ItemReviewFilter; label: string }[] = [
	{ value: 'all', label: 'Todas' },
	{ value: 'pending', label: 'Sin revisar' },
	{ value: 'reviewed', label: 'Revisadas' }
];

// =============================================================================
// Item display helpers
// =============================================================================

export function itemDisplayName(item: PurchaseOrderItemWithProduct): string {
	return item.product?.name ?? item.lensCatalogItem?.name ?? 'Ítem no disponible';
}

export function itemDisplayMeta(item: PurchaseOrderItemWithProduct): string {
	if (item.product?.sku) return item.product.sku;
	if (item.lensCatalogItem?.type) return item.lensCatalogItem.type;
	return getPurchaseOrderItemTypeLabel(item.itemType);
}

export function itemBadgeVariant(item: PurchaseOrderItemWithProduct): 'neutral' | 'info' {
	return item.lensCatalogItem ? 'info' : 'neutral';
}

// =============================================================================
// Lot helpers
// =============================================================================

export function lotForItem(
	item: PurchaseOrderItemWithProduct,
	lotsMap: Record<string, InventoryLot>
): InventoryLot | null {
	return item.lotId ? (lotsMap[item.lotId] ?? null) : null;
}

export function formatLotCode(lotId: string | null, lotsMap: Record<string, InventoryLot>): string {
	if (!lotId) return 'Sin lote';
	const lot = lotsMap[lotId];
	if (!lot) return 'Sin lote';
	return `L-${String(lot.lotNumber).padStart(4, '0')}`;
}

export function canRevertLot(
	item: PurchaseOrderItemWithProduct,
	lotsMap: Record<string, InventoryLot>
): boolean {
	const lot = lotForItem(item, lotsMap);
	return lot ? lot.quantityAvailable === lot.quantityInitial : false;
}

// =============================================================================
// Purchase line total helpers
// =============================================================================

export function purchaseLineTotal(item: PurchaseOrderItemWithProduct): number {
	return item.unitPurchasePrice * item.quantity;
}

export function purchaseLineTotalVes(item: PurchaseOrderItemWithProduct): number {
	return calculateDraftItemTotalAlt(createPurchaseOrderDraftItemFromExisting(item));
}

export function purchaseLineTotalAlt(item: PurchaseOrderItemWithProduct): number {
	return purchaseLineTotalVes(item);
}

// =============================================================================
// Formatting helpers
// =============================================================================

export function formatAltAmount(amount: number, sourceCurrency: string): string {
	const formatted = new Intl.NumberFormat('es-VE', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
	const sym = getSourceCurrencySymbol(sourceCurrency);
	return sym === 'Bs' ? `Bs. ${formatted}` : `${sym} ${formatted}`;
}

/** @deprecated use formatAltAmount */
export function formatVesAmount(amount: number, sourceCurrency: string): string {
	return formatAltAmount(amount, sourceCurrency);
}

export function formatBcvRate(rate: number): string {
	return `${new Intl.NumberFormat('es-VE', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(rate)} VES`;
}

// =============================================================================
// Movement helpers
// =============================================================================

export function movementItemName(
	movement: InventoryMovement,
	items: PurchaseOrderItemWithProduct[]
): string {
	const item = items.find((entry) => entry.lotId === movement.lotId);
	return item ? itemDisplayName(item) : 'Ítem relacionado';
}

export function movementDescription(
	movement: InventoryMovement,
	items: PurchaseOrderItemWithProduct[],
	lotsMap: Record<string, InventoryLot>
): string {
	if (movement.notes) return movement.notes;

	const lotLabel = formatLotCode(movement.lotId, lotsMap);
	const itemName = movementItemName(movement, items);
	const prefix = movement.quantityDelta > 0 ? 'Entrada registrada' : 'Ajuste registrado';
	return `${prefix} para ${itemName} (${lotLabel}).`;
}

// =============================================================================
// Audit classification
// =============================================================================

export function classifyAuditEntry(entry: ChangeHistoryWithUser): AuditEvent | null {
	const { entityType, action, changes } = entry;

	if (entityType === 'purchase_order') {
		if (action === 'create') {
			return {
				id: entry.id,
				label: 'Orden creada',
				changedByName: entry.changedByName,
				changedAt: entry.changedAt,
				entityType,
				action
			};
		}
		if (action === 'update') {
			if (changes.status) {
				const newStatus = changes.status.new as string | null;
				const label = newStatus ? (PO_STATUS_LABELS[newStatus] ?? `Estado: ${newStatus}`) : null;
				if (!label) return null;
				return {
					id: entry.id,
					label,
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action
				};
			}
			if ('readyForReviewAt' in changes || 'isReadyForReview' in changes) {
				const ready = changes.readyForReviewAt?.new ?? changes.isReadyForReview?.new ?? false;
				const label = ready ? 'Enviada a revisión' : 'Devuelta a borrador';
				return {
					id: entry.id,
					label,
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action
				};
			}
			if (changes.paymentTerms) {
				return {
					id: entry.id,
					label: 'Términos de pago actualizados',
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action
				};
			}
			return null;
		}
	}

	if (entityType === 'purchase_order_payment') {
		if (action === 'create') {
			return {
				id: entry.id,
				label: 'Pago registrado',
				changedByName: entry.changedByName,
				changedAt: entry.changedAt,
				entityType,
				action
			};
		}
		if (action === 'update' && changes.voidedAt) {
			return {
				id: entry.id,
				label: 'Pago anulado',
				changedByName: entry.changedByName,
				changedAt: entry.changedAt,
				entityType,
				action
			};
		}
	}

	return null;
}

// =============================================================================
// Document helpers
// =============================================================================

export function getDocumentNumber(
	documentType: string,
	deliveryNoteNumber: string | null | undefined,
	invoiceNumber: string | null | undefined
): string {
	if (documentType === PurchaseDocumentType.DELIVERY_NOTE) {
		return deliveryNoteNumber || '--';
	}
	return invoiceNumber || '--';
}

export function getSupplementalDeliveryNoteNumber(
	documentType: string,
	deliveryNoteNumber: string | null | undefined
): string | null {
	return documentType === PurchaseDocumentType.DELIVERY_NOTE ? null : deliveryNoteNumber || null;
}
