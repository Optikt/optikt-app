import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { ProductType } from '$lib/shared/enums';
import { MaterialProductTypes } from './materials';
import { CreateProductSchema, UpdateProductSchema, ListProductsSchema } from './products';

const baseCreatePayload = {
	sku: 'MODA-999',
	name: 'Montura Prueba',
	type: ProductType.FRAME,
	supplierId: '00000000-0000-4000-8000-000000000001',
	materialId: '00000000-0000-4000-8000-000000000002',
	purchasePrice: 10,
	salePrice: 25
};

describe('CreateProductSchema', () => {
	it('accepts valid payloads with required fields', () => {
		const result = v.safeParse(CreateProductSchema, baseCreatePayload);
		expect(result.success).toBe(true);
	});

	it('requires supplierId', () => {
		const { supplierId: _, ...payloadWithoutSupplier } = baseCreatePayload;
		const result = v.safeParse(CreateProductSchema, payloadWithoutSupplier);
		expect(result.success).toBe(false);
	});

	it('requires materialId', () => {
		const { materialId: _, ...payloadWithoutMaterial } = baseCreatePayload;
		const result = v.safeParse(CreateProductSchema, payloadWithoutMaterial);
		expect(result.success).toBe(false);
	});

	it('allows pending IDs and names for related entities', () => {
		const payload = {
			...baseCreatePayload,
			brandId: 'pending_brand_abc',
			supplierId: 'pending_supplier_xyz',
			materialId: 'pending_material_xyz',
			pendingBrandName: 'Nueva Marca',
			pendingSupplierName: 'Proveedor Nuevo',
			pendingMaterialName: 'Acetato',
			pendingMaterialProductType: MaterialProductTypes[0]
		};

		const result = v.safeParse(CreateProductSchema, payload);
		expect(result.success).toBe(true);
	});

	it('rejects empty string for supplierId', () => {
		const result = v.safeParse(CreateProductSchema, {
			...baseCreatePayload,
			supplierId: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty string for materialId', () => {
		const result = v.safeParse(CreateProductSchema, {
			...baseCreatePayload,
			materialId: ''
		});
		expect(result.success).toBe(false);
	});

	it('allows brandId to be empty string (optional)', () => {
		const result = v.safeParse(CreateProductSchema, {
			...baseCreatePayload,
			brandId: ''
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid SKUs', () => {
		const result = v.safeParse(CreateProductSchema, {
			...baseCreatePayload,
			sku: 'INVALID SKU!'
		});
		expect(result.success).toBe(false);
	});

	it('requires non-negative prices', () => {
		const negativePrice = v.safeParse(CreateProductSchema, {
			...baseCreatePayload,
			purchasePrice: -1,
			salePrice: -5
		});
		expect(negativePrice.success).toBe(false);
	});
});

describe('UpdateProductSchema', () => {
	it('requires uuid id', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: 'not-a-uuid'
		});
		expect(result.success).toBe(false);
	});

	it('accepts partial updates', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: '00000000-0000-4000-8000-000000000000',
			brandId: 'pending_brand_1'
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty string for supplierId (cannot set to null)', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: '00000000-0000-4000-8000-000000000000',
			supplierId: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty string for materialId (cannot set to null)', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: '00000000-0000-4000-8000-000000000000',
			materialId: ''
		});
		expect(result.success).toBe(false);
	});

	it('allows empty string for brandId (can be null)', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: '00000000-0000-4000-8000-000000000000',
			brandId: ''
		});
		expect(result.success).toBe(true);
	});

	it('allows updating supplierId to a valid UUID', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: '00000000-0000-4000-8000-000000000000',
			supplierId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});

	it('allows updating materialId with pending ID', () => {
		const result = v.safeParse(UpdateProductSchema, {
			id: '00000000-0000-4000-8000-000000000000',
			materialId: 'pending_material_new'
		});
		expect(result.success).toBe(true);
	});
});

describe('ListProductsSchema', () => {
	it('applies defaults on empty payloads', () => {
		const result = v.safeParse(ListProductsSchema, {});
		expect(result.success).toBe(true);
		if (!result.success) return;
		const data = result.output;
		expect(data.page).toBe(1);
		expect(data.perPage).toBe(10);
		expect(data.includeInactive).toBe(false);
		expect(data.lowStockOnly).toBe(false);
	});

	it('validates pagination bounds', () => {
		const result = v.safeParse(ListProductsSchema, { page: 0, perPage: 101 });
		expect(result.success).toBe(false);
	});
});
