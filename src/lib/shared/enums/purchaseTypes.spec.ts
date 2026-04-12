import { describe, it, expect } from 'vitest';
import {
	PurchaseOrderStatus,
	ALL_PURCHASE_ORDER_STATUSES,
	PURCHASE_ORDER_STATUS_LABELS,
	getPurchaseOrderStatusLabel,
	purchaseOrderStatusColors,
	getPurchaseOrderStatusBadgeColor,
	PurchaseOrderItemType,
	ALL_PURCHASE_ORDER_ITEM_TYPES,
	PURCHASE_ORDER_ITEM_TYPE_LABELS,
	getPurchaseOrderItemTypeLabel
} from './purchaseTypes';

// ── PurchaseOrderStatus ─────────────────────────────────────────────────

describe('PurchaseOrderStatus enum', () => {
	it('has all expected values', () => {
		expect(PurchaseOrderStatus.DRAFT).toBe('DRAFT');
		expect(PurchaseOrderStatus.CONFIRMED).toBe('CONFIRMED');
		expect(PurchaseOrderStatus.CANCELLED).toBe('CANCELLED');
	});

	it('ALL_PURCHASE_ORDER_STATUSES contains all values', () => {
		expect(ALL_PURCHASE_ORDER_STATUSES).toHaveLength(3);
		expect(ALL_PURCHASE_ORDER_STATUSES).toContain(PurchaseOrderStatus.DRAFT);
		expect(ALL_PURCHASE_ORDER_STATUSES).toContain(PurchaseOrderStatus.CONFIRMED);
		expect(ALL_PURCHASE_ORDER_STATUSES).toContain(PurchaseOrderStatus.CANCELLED);
	});
});

describe('getPurchaseOrderStatusLabel', () => {
	it('returns Spanish labels for known statuses', () => {
		expect(getPurchaseOrderStatusLabel('DRAFT')).toBe('Borrador');
		expect(getPurchaseOrderStatusLabel('CONFIRMED')).toBe('Confirmada');
		expect(getPurchaseOrderStatusLabel('CANCELLED')).toBe('Cancelada');
	});

	it('has a label for every status in the enum', () => {
		for (const status of ALL_PURCHASE_ORDER_STATUSES) {
			expect(PURCHASE_ORDER_STATUS_LABELS[status]).toBeDefined();
		}
	});

	it('returns raw value for unknown status', () => {
		expect(getPurchaseOrderStatusLabel('UNKNOWN')).toBe('UNKNOWN');
	});

	it('returns raw value for empty string', () => {
		expect(getPurchaseOrderStatusLabel('')).toBe('');
	});
});

describe('getPurchaseOrderStatusBadgeColor', () => {
	it('returns correct badge colors', () => {
		expect(getPurchaseOrderStatusBadgeColor('DRAFT')).toBe('warning');
		expect(getPurchaseOrderStatusBadgeColor('CONFIRMED')).toBe('success');
		expect(getPurchaseOrderStatusBadgeColor('CANCELLED')).toBe('error');
	});

	it('has a color for every status in the enum', () => {
		for (const status of ALL_PURCHASE_ORDER_STATUSES) {
			expect(purchaseOrderStatusColors[status]).toBeDefined();
		}
	});

	it('returns warning (default) for unknown status', () => {
		expect(getPurchaseOrderStatusBadgeColor('INVALID')).toBe('warning');
	});
});

// ── PurchaseOrderItemType ───────────────────────────────────────────────

describe('PurchaseOrderItemType enum', () => {
	it('has all expected values', () => {
		expect(PurchaseOrderItemType.PRODUCT).toBe('PRODUCT');
		expect(PurchaseOrderItemType.LENS).toBe('LENS');
	});

	it('ALL_PURCHASE_ORDER_ITEM_TYPES contains all values', () => {
		expect(ALL_PURCHASE_ORDER_ITEM_TYPES).toHaveLength(2);
		expect(ALL_PURCHASE_ORDER_ITEM_TYPES).toContain(PurchaseOrderItemType.PRODUCT);
		expect(ALL_PURCHASE_ORDER_ITEM_TYPES).toContain(PurchaseOrderItemType.LENS);
	});
});

describe('getPurchaseOrderItemTypeLabel', () => {
	it('returns Spanish labels for known types', () => {
		expect(getPurchaseOrderItemTypeLabel('PRODUCT')).toBe('Producto');
		expect(getPurchaseOrderItemTypeLabel('LENS')).toBe('Lente');
	});

	it('has a label for every item type in the enum', () => {
		for (const type of ALL_PURCHASE_ORDER_ITEM_TYPES) {
			expect(PURCHASE_ORDER_ITEM_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns raw value for unknown type', () => {
		expect(getPurchaseOrderItemTypeLabel('UNKNOWN')).toBe('UNKNOWN');
	});

	it('returns raw value for empty string', () => {
		expect(getPurchaseOrderItemTypeLabel('')).toBe('');
	});
});
