import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { partialUpdate } from './partialUpdate';
import { UpdateCustomerSchema } from '../customers';
import { UpdateUserSchema } from '../users';
import { UpdateBrandSchema } from '../brands';
import { UpdateSupplierSchema } from '../suppliers';
import { UpdateMaterialSchema } from '../materials';
import { UpdateProductSchema } from '../products';
import {
	UpdateLensCatalogItemSchema,
	UpdateLensMaterialSchema,
	UpdateLensTechnologySchema
} from '../lenses';

const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('partialUpdate', () => {
	it('quita defaults: una clave omitida queda undefined', () => {
		const schema = partialUpdate(
			z.object({
				flag: z.boolean().default(true),
				name: z.string(),
				list: z
					.string()
					.default('[]')
					.transform((v) => JSON.parse(v) as unknown[])
			})
		);
		expect(schema.parse({})).toEqual({});
		expect(schema.parse({ flag: false })).toEqual({ flag: false });
		expect(schema.parse({ list: '[1]' })).toEqual({ list: [1] });
	});

	it('conserva validaciones del schema de creación', () => {
		const schema = partialUpdate(z.object({ name: z.string().min(2) }));
		expect(schema.safeParse({ name: 'a' }).success).toBe(false);
	});

	it.each([
		['customers', UpdateCustomerSchema],
		['users', UpdateUserSchema],
		['brands', UpdateBrandSchema],
		['suppliers', UpdateSupplierSchema],
		['materials', UpdateMaterialSchema],
		['products', UpdateProductSchema],
		['lens materials', UpdateLensMaterialSchema],
		['lens technologies', UpdateLensTechnologySchema],
		['lens catalog', UpdateLensCatalogItemSchema]
	] as const)('Update schema de %s: { id } no inventa campos', (_name, schema) => {
		expect((schema as z.ZodType).parse({ id })).toEqual({ id });
	});

	it('lens catalog: un update parcial no resetea booleanos, precios ni modo de inventario', () => {
		expect(UpdateLensCatalogItemSchema.parse({ id, name: 'Nuevo' })).toEqual({ id, name: 'Nuevo' });
	});
});
