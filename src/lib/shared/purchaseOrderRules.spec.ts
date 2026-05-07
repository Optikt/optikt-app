import { describe, expect, it } from 'vitest';
import { PurchaseOrderItemType } from './enums';
import {
	getPurchaseOrderDraftReadinessIssues,
	isPurchaseOrderDraftReady,
	validatePurchaseOrderDraftReadiness,
	type PurchaseOrderDraftHeaderRulesInput,
	type PurchaseOrderDraftLineRulesInput
} from './purchaseOrderRules';

const validHeader: PurchaseOrderDraftHeaderRulesInput = {
	supplierId: '00000000-0000-4000-8000-000000000001',
	orderDate: '2025-01-15',
	bcvRate: 65.5,
	notes: 'Compra directa al proveedor'
};

const validItem: PurchaseOrderDraftLineRulesInput = {
	itemType: PurchaseOrderItemType.PRODUCT,
	productId: '00000000-0000-4000-8000-000000000002',
	lensCatalogItemId: null,
	quantity: 2,
	unitPurchasePrice: 10,
	unitSalePrice: 25,
	appliesIva: true,
	ivaRate: 16
};

describe('purchase order draft readiness rules', () => {
	it('accepts a complete draft as ready', () => {
		const result = validatePurchaseOrderDraftReadiness(validHeader, [validItem]);

		expect(result.isReady).toBe(true);
		expect(result.issues).toEqual([]);
		expect(isPurchaseOrderDraftReady(validHeader, [validItem])).toBe(true);
	});

	it('rejects missing header data and empty items', () => {
		const issues = getPurchaseOrderDraftReadinessIssues(
			{ supplierId: null, orderDate: null, bcvRate: 0, notes: 'abc' },
			[]
		);

		expect(issues).toContain('Selecciona un proveedor');
		expect(issues).toContain('Selecciona una fecha de orden');
		expect(issues).toContain('Define una tasa BCV mayor a 0');
		expect(issues).toContain('Agrega observaciones de al menos 6 caracteres');
		expect(issues).toContain('Agrega al menos una línea');
	});

	it('validates product and lens references by item type', () => {
		const issues = getPurchaseOrderDraftReadinessIssues(validHeader, [
			{ ...validItem, productId: null },
			{
				...validItem,
				itemType: PurchaseOrderItemType.LENS,
				productId: null,
				lensCatalogItemId: null
			}
		]);

		expect(issues).toContain('Línea 1: selecciona un producto');
		expect(issues).toContain('Línea 2: selecciona un lente');
	});

	it('allows zero purchase and sale prices but rejects negatives', () => {
		const zeroResult = validatePurchaseOrderDraftReadiness(validHeader, [
			{ ...validItem, unitPurchasePrice: 0, unitSalePrice: 0 }
		]);
		const negativeIssues = getPurchaseOrderDraftReadinessIssues(validHeader, [
			{ ...validItem, unitPurchasePrice: -1, unitSalePrice: -2 }
		]);

		expect(zeroResult.isReady).toBe(true);
		expect(negativeIssues).toContain('Línea 1: el costo no puede ser negativo');
		expect(negativeIssues).toContain('Línea 1: la venta sugerida no puede ser negativa');
	});
});
