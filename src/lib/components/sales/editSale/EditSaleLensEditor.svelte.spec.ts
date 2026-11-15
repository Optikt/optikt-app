import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { DiscountType } from '$lib/shared/enums';
import { LensCatalogSource, SaleItemType, LensType } from '$lib/shared/enums/lensTypes';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import type { EditableItem } from '../editSaleDraft';
import { cacheCatalogItems } from '../catalogCache.svelte';
import EditSaleLensEditor from './EditSaleLensEditor.svelte';

const searchCatalog = vi.hoisted(() => vi.fn());
const getCatalogItemsByIds = vi.hoisted(() => vi.fn());

vi.mock('$lib/remote/catalog.remote', () => ({
	searchCatalog: (...args: unknown[]) => searchCatalog(...args),
	getCatalogItemsByIds: (...args: unknown[]) => getCatalogItemsByIds(...args)
}));

const lens = {
	id: 'lens-1',
	name: 'Nueva Visión Monofocal',
	type: LensType.MONOFOCAL,
	source: LensCatalogSource.LAB,
	material: null,
	supplier: { id: 'sup-1', name: 'Laboratorio Óptico' },
	technologyName: null,
	ranges: [],
	salePrice: 20,
	pairPurchasePrice: 10,
	mountingPrice: 0,
	shippingPrice: 0,
	priceType: 'FIXED',
	isTaxable: true,
	hasAr: false,
	hasBluecut: false,
	isPhotochromic: false
} as unknown as LensCatalogItemWithRelations;

function existingItem(): EditableItem {
	return {
		id: 'item-1',
		itemType: SaleItemType.LENS_PAIR,
		lensCatalogItemId: 'lens-1',
		quantity: 1,
		unitPrice: 40,
		discount: 0,
		discountType: DiscountType.FIXED,
		odSphere: -2,
		snapshotName: 'Nueva Visión Monofocal',
		snapshotBrand: 'Laboratorio Óptico',
		_removed: false
	};
}

test('el borrador editado (precio + fórmula) llega al item aplicado', async () => {
	cacheCatalogItems([], [lens]);
	searchCatalog.mockResolvedValue({ products: [], lensItems: [lens] });
	getCatalogItemsByIds.mockResolvedValue({ products: [], lensItems: [lens] });

	const onApply = vi.fn();
	const screen = await render(EditSaleLensEditor, {
		item: existingItem(),
		editTreatments: [],
		treatments: [],
		onApply
	});

	// El usuario cambia el precio (40 → 55) y la graduación (−2 → +1.50).
	// El precio es el único input[type=number] sin aria-label (el de descuento lo lleva).
	const priceInput = screen.container.querySelector<HTMLInputElement>(
		'input[type="number"]:not([aria-label])'
	);
	expect(priceInput).not.toBeNull();
	priceInput!.value = '55';
	priceInput!.dispatchEvent(new Event('input', { bubbles: true }));

	const sphereInput = screen.container.querySelector<HTMLInputElement>(
		'input[aria-label="OD · derecho Esfera"]'
	);
	expect(sphereInput).not.toBeNull();
	sphereInput!.value = '1.5';
	sphereInput!.dispatchEvent(new Event('input', { bubbles: true }));

	await new Promise((resolve) => setTimeout(resolve, 50));

	await screen.component.apply();
	await expect.poll(() => onApply.mock.calls.length).toBeGreaterThan(0);

	const saved = onApply.mock.calls[0][0] as EditableItem;
	expect(saved.unitPrice).toBe(55);
	expect(saved.odSphere).toBe(1.5);
});

test('al agregar un cristal nuevo guarda enlace, precio y graduación', async () => {
	cacheCatalogItems([], [lens]);
	searchCatalog.mockResolvedValue({ products: [], lensItems: [lens] });
	getCatalogItemsByIds.mockResolvedValue({ products: [], lensItems: [lens] });

	// Placeholder tal cual lo crea «Agregar → Cristal».
	const placeholder: EditableItem = {
		id: crypto.randomUUID(),
		itemType: SaleItemType.LENS_PAIR,
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		_removed: false
	};

	const onApply = vi.fn();
	const screen = await render(EditSaleLensEditor, {
		item: placeholder,
		editTreatments: [],
		treatments: [],
		onApply
	});

	// Seleccionar el cristal en el combobox (búsqueda con debounce de 250 ms).
	const combobox = screen.container.querySelector<HTMLInputElement>(
		'input[placeholder="Buscar lente..."]'
	);
	expect(combobox).not.toBeNull();
	combobox!.value = 'nueva';
	combobox!.dispatchEvent(new Event('input', { bubbles: true }));

	await expect
		.poll(() => screen.container.querySelectorAll('[role="option"]').length, { timeout: 3000 })
		.toBeGreaterThan(0);
	(screen.container.querySelector('[role="option"]') as HTMLButtonElement).click();

	// Sólo OD con receta: apagar el OI para que la validación deje pasar.
	(
		screen.container.querySelector(
			'input[aria-label="Ojo izquierdo lleva receta"]'
		) as HTMLInputElement
	).click();
	const sphereInput = screen.container.querySelector<HTMLInputElement>(
		'input[aria-label="OD · derecho Esfera"]'
	);
	expect(sphereInput).not.toBeNull();
	sphereInput!.value = '1.5';
	sphereInput!.dispatchEvent(new Event('input', { bubbles: true }));

	await new Promise((resolve) => setTimeout(resolve, 100));

	await screen.component.apply();
	await expect.poll(() => onApply.mock.calls.length).toBeGreaterThan(0);

	const saved = onApply.mock.calls[0][0] as EditableItem;
	expect(saved.lensCatalogItemId).toBe('lens-1');
	expect(saved.snapshotName).toBe('Nueva Visión Monofocal');
	expect(saved.unitPrice).toBe(20);
	expect(saved.odSphere).toBe(1.5);
});
