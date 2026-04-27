import { describe, it, expect } from 'vitest';
import { ProductType } from '$lib/shared/enums';
import { MaterialCategories } from './materials';
import { CreateProductSchema, UpdateProductSchema, ListProductsSchema } from './products';

const baseCreatePayload = {
	sku: 'MODA-999',
	name: 'Montura Prueba',
	type: ProductType.FRAME,
	supplierId: '00000000-0000-4000-8000-000000000001',
	materialId: '00000000-0000-4000-8000-000000000002'
};

describe('CreateProductSchema', () => {
	it('accepts valid payloads with required fields', () => {
		const result = CreateProductSchema.safeParse(baseCreatePayload);
		expect(result.success).toBe(true);
	});

	it('uppercases sku and personal code during create parsing', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			sku: 'moda-abc-123',
			personalCode: 'ab-12 c2'
		});

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.sku).toBe('MODA-ABC-123');
		expect(result.data.personalCode).toBe('AB-12 C2');
	});

	it('requires supplierId', () => {
		const { supplierId: _, ...payloadWithoutSupplier } = baseCreatePayload;
		const result = CreateProductSchema.safeParse(payloadWithoutSupplier);
		expect(result.success).toBe(false);
	});

	it('requires materialId', () => {
		const { materialId: _, ...payloadWithoutMaterial } = baseCreatePayload;
		const result = CreateProductSchema.safeParse(payloadWithoutMaterial);
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
			pendingMaterialCategory: MaterialCategories[0]
		};

		const result = CreateProductSchema.safeParse(payload);
		expect(result.success).toBe(true);
	});

	it('accepts FRAME as pending material category for sunglasses', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			type: ProductType.SUNGLASSES,
			materialId: 'pending_material_xyz',
			pendingMaterialName: 'TR90',
			pendingMaterialCategory: ProductType.FRAME
		});

		expect(result.success).toBe(true);
	});

	it('rejects empty string for supplierId', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			supplierId: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty string for materialId', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			materialId: ''
		});
		expect(result.success).toBe(false);
	});

	it('allows brandId to be empty string (optional)', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			brandId: ''
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid SKUs', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			sku: 'INVALID SKU!'
		});
		expect(result.success).toBe(false);
	});
});

describe('UpdateProductSchema', () => {
	it('requires uuid id', () => {
		const result = UpdateProductSchema.safeParse({
			id: 'not-a-uuid'
		});
		expect(result.success).toBe(false);
	});

	it('accepts partial updates', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			brandId: 'pending_brand_1'
		});
		expect(result.success).toBe(true);
	});

	it('uppercases sku and personal code during update parsing', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			sku: 'ls-met-aug-plata-s25666-1-c2',
			personalCode: 's25666-1 c2'
		});

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.sku).toBe('LS-MET-AUG-PLATA-S25666-1-C2');
		expect(result.data.personalCode).toBe('S25666-1 C2');
	});

	it('rejects empty string for supplierId (cannot set to null)', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			supplierId: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty string for materialId (cannot set to null)', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			materialId: ''
		});
		expect(result.success).toBe(false);
	});

	it('allows empty string for brandId (can be null)', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			brandId: ''
		});
		expect(result.success).toBe(true);
	});

	it('allows updating supplierId to a valid UUID', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			supplierId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});

	it('allows updating materialId with pending ID', () => {
		const result = UpdateProductSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			materialId: 'pending_material_new'
		});
		expect(result.success).toBe(true);
	});
});

describe('ListProductsSchema', () => {
	it('applies defaults on empty payloads', () => {
		const result = ListProductsSchema.safeParse({});
		expect(result.success).toBe(true);
		if (!result.success) return;
		const data = result.data;
		expect(data.page).toBe(1);
		expect(data.perPage).toBe(10);
		expect(data.includeInactive).toBe(false);
		expect(data.lowStockOnly).toBe(false);
	});

	it('validates pagination bounds', () => {
		const result = ListProductsSchema.safeParse({ page: 0, perPage: 101 });
		expect(result.success).toBe(false);
	});
});

describe('CreateProductSchema — physical attributes', () => {
	it('accepts frame dimensions as integers', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			lensWidth: 50,
			bridgeWidth: 22,
			templeLength: 145
		});
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.lensWidth).toBe(50);
		expect(result.data.bridgeWidth).toBe(22);
		expect(result.data.templeLength).toBe(145);
	});

	it('coerces string numbers for frame dimensions', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			lensWidth: '52',
			bridgeWidth: '18',
			templeLength: '140'
		});
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.lensWidth).toBe(52);
		expect(result.data.bridgeWidth).toBe(18);
		expect(result.data.templeLength).toBe(140);
	});

	it('accepts contact lens attributes', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			type: ProductType.CONTACT_LENS,
			baseCurve: 8.6,
			diameter: 14.2
		});
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.baseCurve).toBe(8.6);
		expect(result.data.diameter).toBe(14.2);
	});

	it('rejects out-of-range lensWidth', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			lensWidth: 0
		});
		expect(result.success).toBe(false);
	});

	it('rejects out-of-range templeLength', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			templeLength: 1000
		});
		expect(result.success).toBe(false);
	});

	it('rejects out-of-range baseCurve', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			baseCurve: 4.0
		});
		expect(result.success).toBe(false);
	});

	it('accepts product with no physical attributes (all optional)', () => {
		const result = CreateProductSchema.safeParse(baseCreatePayload);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.lensWidth).toBeUndefined();
		expect(result.data.bridgeWidth).toBeUndefined();
		expect(result.data.templeLength).toBeUndefined();
		expect(result.data.baseCurve).toBeUndefined();
		expect(result.data.diameter).toBeUndefined();
	});

	it('treats empty string frame dimensions as undefined', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			lensWidth: '',
			bridgeWidth: '',
			templeLength: ''
		});

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.lensWidth).toBeUndefined();
		expect(result.data.bridgeWidth).toBeUndefined();
		expect(result.data.templeLength).toBeUndefined();
	});

	it('treats empty string contact lens attributes as undefined', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			type: ProductType.CONTACT_LENS,
			baseCurve: '',
			diameter: ''
		});

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.baseCurve).toBeUndefined();
		expect(result.data.diameter).toBeUndefined();
	});

	it('returns Spanish messages for invalid physical attributes', () => {
		const result = CreateProductSchema.safeParse({
			...baseCreatePayload,
			lensWidth: 0,
			baseCurve: 4
		});

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ['lensWidth'],
					message: 'Calibre debe ser mayor o igual a 1'
				}),
				expect.objectContaining({
					path: ['baseCurve'],
					message: 'Curva base debe ser mayor o igual a 5'
				})
			])
		);
	});
});
