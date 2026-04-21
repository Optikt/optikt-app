import { describe, it, expect } from 'vitest';
import {
	InventoryMovementType,
	ALL_INVENTORY_MOVEMENT_TYPES,
	INVENTORY_MOVEMENT_TYPE_LABELS,
	getInventoryMovementTypeLabel,
	MovementReferenceType,
	ALL_MOVEMENT_REFERENCE_TYPES,
	MOVEMENT_REFERENCE_TYPE_LABELS,
	getMovementReferenceTypeLabel,
	AdjustmentReason,
	ALL_ADJUSTMENT_REASONS,
	ADJUSTMENT_REASON_LABELS,
	getAdjustmentReasonLabel,
	ADJUSTMENT_REPORT_CATEGORIES,
	LOSS_REASONS
} from './inventoryTypes';

// ── InventoryMovementType ───────────────────────────────────────────────

describe('InventoryMovementType enum', () => {
	it('has all expected values', () => {
		expect(InventoryMovementType.PURCHASE_IN).toBe('PURCHASE_IN');
		expect(InventoryMovementType.SALE_OUT).toBe('SALE_OUT');
		expect(InventoryMovementType.ADJUSTMENT_IN).toBe('ADJUSTMENT_IN');
		expect(InventoryMovementType.ADJUSTMENT_OUT).toBe('ADJUSTMENT_OUT');
		expect(InventoryMovementType.RETURN_IN).toBe('RETURN_IN');
		expect(InventoryMovementType.CANCEL_REVERT).toBe('CANCEL_REVERT');
	});

	it('ALL_INVENTORY_MOVEMENT_TYPES contains all values', () => {
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toHaveLength(6);
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toContain(InventoryMovementType.PURCHASE_IN);
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toContain(InventoryMovementType.SALE_OUT);
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toContain(InventoryMovementType.ADJUSTMENT_IN);
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toContain(InventoryMovementType.ADJUSTMENT_OUT);
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toContain(InventoryMovementType.RETURN_IN);
		expect(ALL_INVENTORY_MOVEMENT_TYPES).toContain(InventoryMovementType.CANCEL_REVERT);
	});
});

describe('getInventoryMovementTypeLabel', () => {
	it('returns Spanish labels for known types', () => {
		expect(getInventoryMovementTypeLabel('PURCHASE_IN')).toBe('Entrada por compra');
		expect(getInventoryMovementTypeLabel('SALE_OUT')).toBe('Salida por venta');
		expect(getInventoryMovementTypeLabel('ADJUSTMENT_IN')).toBe('Ajuste positivo');
		expect(getInventoryMovementTypeLabel('ADJUSTMENT_OUT')).toBe('Ajuste negativo');
		expect(getInventoryMovementTypeLabel('RETURN_IN')).toBe('Devolución');
		expect(getInventoryMovementTypeLabel('CANCEL_REVERT')).toBe('Reversión por cancelación');
	});

	it('has a label for every movement type', () => {
		for (const type of ALL_INVENTORY_MOVEMENT_TYPES) {
			expect(INVENTORY_MOVEMENT_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns raw value for unknown type', () => {
		expect(getInventoryMovementTypeLabel('UNKNOWN')).toBe('UNKNOWN');
	});

	it('returns raw value for empty string', () => {
		expect(getInventoryMovementTypeLabel('')).toBe('');
	});
});

// ── MovementReferenceType ───────────────────────────────────────────────

describe('MovementReferenceType enum', () => {
	it('has all expected values', () => {
		expect(MovementReferenceType.PURCHASE_ORDER).toBe('PURCHASE_ORDER');
		expect(MovementReferenceType.SALE).toBe('SALE');
		expect(MovementReferenceType.MANUAL_ADJUSTMENT).toBe('MANUAL_ADJUSTMENT');
	});

	it('ALL_MOVEMENT_REFERENCE_TYPES contains all values', () => {
		expect(ALL_MOVEMENT_REFERENCE_TYPES).toHaveLength(3);
		expect(ALL_MOVEMENT_REFERENCE_TYPES).toContain(MovementReferenceType.PURCHASE_ORDER);
		expect(ALL_MOVEMENT_REFERENCE_TYPES).toContain(MovementReferenceType.SALE);
		expect(ALL_MOVEMENT_REFERENCE_TYPES).toContain(MovementReferenceType.MANUAL_ADJUSTMENT);
	});
});

describe('getMovementReferenceTypeLabel', () => {
	it('returns Spanish labels for known types', () => {
		expect(getMovementReferenceTypeLabel('PURCHASE_ORDER')).toBe('Orden de compra');
		expect(getMovementReferenceTypeLabel('SALE')).toBe('Venta');
		expect(getMovementReferenceTypeLabel('MANUAL_ADJUSTMENT')).toBe('Ajuste manual');
	});

	it('has a label for every reference type', () => {
		for (const type of ALL_MOVEMENT_REFERENCE_TYPES) {
			expect(MOVEMENT_REFERENCE_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns raw value for unknown type', () => {
		expect(getMovementReferenceTypeLabel('TRANSFER')).toBe('TRANSFER');
	});
});

// ── AdjustmentReason ────────────────────────────────────────────────────

describe('AdjustmentReason enum', () => {
	it('has all expected values', () => {
		expect(AdjustmentReason.PHYSICAL_COUNT).toBe('PHYSICAL_COUNT');
		expect(AdjustmentReason.DAMAGE).toBe('DAMAGE');
		expect(AdjustmentReason.SAMPLE).toBe('SAMPLE');
		expect(AdjustmentReason.CUSTOMER_RETURN).toBe('CUSTOMER_RETURN');
		expect(AdjustmentReason.ENTRY_ERROR).toBe('ENTRY_ERROR');
		expect(AdjustmentReason.OTHER).toBe('OTHER');
	});

	it('ALL_ADJUSTMENT_REASONS contains all values', () => {
		expect(ALL_ADJUSTMENT_REASONS).toHaveLength(6);
		expect(ALL_ADJUSTMENT_REASONS).toContain(AdjustmentReason.PHYSICAL_COUNT);
		expect(ALL_ADJUSTMENT_REASONS).toContain(AdjustmentReason.DAMAGE);
		expect(ALL_ADJUSTMENT_REASONS).toContain(AdjustmentReason.SAMPLE);
		expect(ALL_ADJUSTMENT_REASONS).toContain(AdjustmentReason.CUSTOMER_RETURN);
		expect(ALL_ADJUSTMENT_REASONS).toContain(AdjustmentReason.ENTRY_ERROR);
		expect(ALL_ADJUSTMENT_REASONS).toContain(AdjustmentReason.OTHER);
	});
});

describe('getAdjustmentReasonLabel', () => {
	it('returns Spanish labels for known reasons', () => {
		expect(getAdjustmentReasonLabel('PHYSICAL_COUNT')).toBe('Conteo físico');
		expect(getAdjustmentReasonLabel('DAMAGE')).toBe('Daño / merma');
		expect(getAdjustmentReasonLabel('SAMPLE')).toBe('Muestra o cortesía');
		expect(getAdjustmentReasonLabel('CUSTOMER_RETURN')).toBe(
			'Devolución de cliente (sin reembolso)'
		);
		expect(getAdjustmentReasonLabel('ENTRY_ERROR')).toBe('Error de registro');
		expect(getAdjustmentReasonLabel('OTHER')).toBe('Otro');
	});

	it('has a label for every adjustment reason', () => {
		for (const reason of ALL_ADJUSTMENT_REASONS) {
			expect(ADJUSTMENT_REASON_LABELS[reason]).toBeDefined();
		}
	});

	it('returns raw value for unknown reason', () => {
		expect(getAdjustmentReasonLabel('THEFT')).toBe('THEFT');
	});

	it('returns raw value for empty string', () => {
		expect(getAdjustmentReasonLabel('')).toBe('');
	});
});

describe('ADJUSTMENT_REPORT_CATEGORIES', () => {
	it('has a category for every adjustment reason', () => {
		for (const reason of ALL_ADJUSTMENT_REASONS) {
			expect(ADJUSTMENT_REPORT_CATEGORIES[reason]).toBeDefined();
		}
	});

	it('maps DAMAGE and SAMPLE to loss-related categories', () => {
		expect(ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.DAMAGE]).toBe('Pérdidas operativas');
		expect(ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.SAMPLE]).toBe('Muestras y cortesías');
	});

	it('maps informational reasons to inventory adjustments', () => {
		expect(ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.PHYSICAL_COUNT]).toBe(
			'Ajustes de inventario'
		);
		expect(ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.ENTRY_ERROR]).toBe(
			'Ajustes de inventario'
		);
		expect(ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.OTHER]).toBe('Ajustes de inventario');
	});

	it('maps CUSTOMER_RETURN to its own category', () => {
		expect(ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.CUSTOMER_RETURN]).toBe(
			'Devoluciones recibidas'
		);
	});
});

describe('LOSS_REASONS', () => {
	it('contains only DAMAGE and SAMPLE', () => {
		expect(LOSS_REASONS).toHaveLength(2);
		expect(LOSS_REASONS).toContain(AdjustmentReason.DAMAGE);
		expect(LOSS_REASONS).toContain(AdjustmentReason.SAMPLE);
	});

	it('does not include informational reasons', () => {
		expect(LOSS_REASONS).not.toContain(AdjustmentReason.PHYSICAL_COUNT);
		expect(LOSS_REASONS).not.toContain(AdjustmentReason.CUSTOMER_RETURN);
		expect(LOSS_REASONS).not.toContain(AdjustmentReason.ENTRY_ERROR);
		expect(LOSS_REASONS).not.toContain(AdjustmentReason.OTHER);
	});
});
