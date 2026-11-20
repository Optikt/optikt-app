/**
 * DT26 — updates parciales de lentes no anulan ni resetean campos omitidos
 * (materiales, tecnologías, catálogo).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { updateLensMaterialForm } from './materials.remote';
import { updateLensTechnologyForm } from './technologies.remote';
import { updateLensCatalogItemForm } from './catalog-update.remote';
import { callRemoteForm } from '$lib/testing/remoteHarness';
import { resetDb } from '$lib/testing/integration/db';
import { createSupplier, createUser } from '$lib/testing/integration/factories';
import { createLensMaterial } from '$lib/server/db/queries/lenses/materials';
import { createLensTechnology } from '$lib/server/db/queries/lenses/technologies';
import { createLensCatalogItem } from '$lib/server/db/queries/lenses/catalog';
import { LensInventoryMode, LensPriceType, LensType } from '$lib/shared/enums/lensTypes';
import { UserRole } from '$lib/shared/enums/roles';
import type { LensCatalogItem, LensMaterial, LensTechnology } from '$lib/server/db/schema';

type Payload = Record<string, unknown>;

describe('DT26 · updates parciales (lentes)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('lens materials: cambiar el nombre conserva índice y descripción', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const material = await createLensMaterial({
			name: 'Policarbonato',
			code: 'PC',
			refractiveIndex: 1.59,
			description: 'Resistente a impactos'
		});

		const updated = await callRemoteForm<Payload, LensMaterial>(
			updateLensMaterialForm,
			{ id: material.id, name: 'Policarbonato HD' },
			{ user }
		);

		expect(updated.name).toBe('Policarbonato HD');
		expect(updated.refractiveIndex).toBe(1.59);
		expect(updated.description).toBe('Resistente a impactos');
	});

	it('lens technologies: cambiar el nombre conserva proveedor y altura mínima', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const tech = await createLensTechnology({
			name: 'Digital Pro',
			supplierId: supplier.id,
			minFittingHeight: 14
		});

		const updated = await callRemoteForm<Payload, LensTechnology>(
			updateLensTechnologyForm,
			{ id: tech.id, name: 'Digital Pro 2' },
			{ user }
		);

		expect(updated.name).toBe('Digital Pro 2');
		expect(updated.supplierId).toBe(supplier.id);
		expect(updated.minFittingHeight).toBe(14);
	});

	it('lens catalog: update parcial no resetea booleanos, precios, modo ni stock', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createLensMaterial({
			name: 'CR-39',
			code: 'CR39',
			refractiveIndex: 1.5
		});
		const item = await createLensCatalogItem(
			{
				name: 'Monofocal AR',
				type: LensType.MONOFOCAL,
				supplierId: supplier.id,
				materialId: material.id,
				hasAr: true,
				hasBluecut: true,
				isTaxable: true,
				priceType: LensPriceType.PAIR,
				basePrice: 30,
				mountingPrice: 5,
				shippingPrice: 2,
				inventoryMode: LensInventoryMode.STOCK,
				stock: 7
			},
			[]
		);

		const updated = await callRemoteForm<Payload, LensCatalogItem>(
			updateLensCatalogItemForm,
			{ id: item.id, name: 'Monofocal AR Plus' },
			{ user }
		);

		expect(updated.name).toBe('Monofocal AR Plus');
		expect(updated.hasAr).toBe(true);
		expect(updated.hasBluecut).toBe(true);
		expect(updated.isTaxable).toBe(true);
		expect(updated.priceType).toBe(LensPriceType.PAIR);
		expect(updated.mountingPrice).toBe(5);
		expect(updated.shippingPrice).toBe(2);
		expect(updated.inventoryMode).toBe(LensInventoryMode.STOCK);
		expect(updated.stock).toBe(7);
	});

	it('lens catalog: guardar sin cambios no escribe la fila (updatedAt intacto)', async () => {
		const user = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createLensMaterial({
			name: 'CR-39',
			code: 'CR39',
			refractiveIndex: 1.5
		});
		const item = await createLensCatalogItem(
			{
				name: 'Monofocal',
				type: LensType.MONOFOCAL,
				supplierId: supplier.id,
				materialId: material.id,
				priceType: LensPriceType.PAIR,
				basePrice: 30
			},
			[]
		);

		// First save may normalize derived fields (pairPurchasePrice)
		const first = await callRemoteForm<Payload, LensCatalogItem>(
			updateLensCatalogItemForm,
			{ id: item.id, name: 'Monofocal' },
			{ user }
		);
		const second = await callRemoteForm<Payload, LensCatalogItem>(
			updateLensCatalogItemForm,
			{ id: item.id, name: 'Monofocal' },
			{ user }
		);

		expect(second.updatedAt).toBe(first.updatedAt);
	});
});
