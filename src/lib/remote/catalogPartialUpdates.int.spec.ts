/**
 * DT26 — updates parciales no anulan ni resetean campos omitidos
 * (brands, suppliers, materials, products).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { updateBrandForm } from './brands.remote';
import { updateSupplierForm } from './suppliers.remote';
import { updateMaterialForm } from './materials.remote';
import { updateProductForm } from './products.remote';
import { callRemoteForm } from '$lib/testing/remoteHarness';
import { resetDb } from '$lib/testing/integration/db';
import {
	createBrand,
	createMaterial,
	createProduct,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { UserRole } from '$lib/shared/enums/roles';
import type { Brand, Material, Product, Supplier } from '$lib/server/db/schema';

type Payload = Record<string, unknown>;

describe('DT26 · updates parciales (catálogo)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('brands: cambiar el nombre no borra descripción/país/web', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const brand = await createBrand({
			description: 'Gafas italianas',
			country: 'Italia',
			website: 'https://marca.test'
		});

		const updated = await callRemoteForm<Payload, Brand>(
			updateBrandForm,
			{ id: brand.id, name: 'Marca Renombrada' },
			{ user }
		);

		expect(updated.name).toBe('Marca Renombrada');
		expect(updated.description).toBe('Gafas italianas');
		expect(updated.country).toBe('Italia');
		expect(updated.website).toBe('https://marca.test');
	});

	it('suppliers: update parcial conserva el RIF; "" lo vacía a propósito', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier({
			rif: 'J-12345678-9',
			address: 'Av. Principal',
			notes: 'Entrega los martes'
		});

		const updated = await callRemoteForm<Payload, Supplier>(
			updateSupplierForm,
			{ id: supplier.id, contactName: 'María' },
			{ user }
		);
		expect(updated.contactName).toBe('María');
		expect(updated.rif).toBe('J-12345678-9');
		expect(updated.address).toBe('Av. Principal');
		expect(updated.notes).toBe('Entrega los martes');

		const cleared = await callRemoteForm<Payload, Supplier>(
			updateSupplierForm,
			{ id: supplier.id, rif: '' },
			{ user }
		);
		expect(cleared.rif).toBeNull();
		expect(cleared.contactName).toBe('María');
	});

	it('materials: update parcial conserva la descripción', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const material = await createMaterial({ description: 'Acetato premium' });

		const updated = await callRemoteForm<Payload, Material>(
			updateMaterialForm,
			{ id: material.id, name: 'Acetato Plus' },
			{ user }
		);

		expect(updated.name).toBe('Acetato Plus');
		expect(updated.description).toBe('Acetato premium');
		expect(updated.code).toBe(material.code);
	});

	it('products: update parcial no resetea isTaxable/isAutoSku ni borra marca/color', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createMaterial();
		const brand = await createBrand();
		const product = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			brandId: brand.id,
			isTaxable: false,
			isAutoSku: true,
			color: 'Negro'
		});

		const updated = await callRemoteForm<Payload, Product>(
			updateProductForm,
			{ id: product.id, name: 'Montura Renombrada' },
			{ user }
		);

		expect(updated.name).toBe('Montura Renombrada');
		expect(updated.isTaxable).toBe(false);
		expect(updated.isAutoSku).toBe(true);
		expect(updated.brandId).toBe(brand.id);
		expect(updated.color).toBe('Negro');
		expect(updated.sku).toBe(product.sku);
	});

	it('un guardado sin cambios no escribe (updatedAt intacto)', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const brand = await createBrand({ description: 'Igual' });

		const same = await callRemoteForm<Payload, Brand>(
			updateBrandForm,
			{ id: brand.id, name: brand.name, description: 'Igual' },
			{ user }
		);

		expect(same.updatedAt).toBe(brand.updatedAt);
	});
});
