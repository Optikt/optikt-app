import { describe, expect, it } from 'vitest';
import { DiscountType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { ProductType } from '$lib/shared/enums/productTypes';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { EditableItem } from '../editSaleDraft';
import type { SaleItemRow } from '../newSaleTypes';
import {
	assignWhole,
	clampUiGroups,
	groupLabel,
	groupLensIds,
	groupUnits,
	memberQty,
	newUiGroup,
	personColor,
	personInitials,
	removeGroup,
	renameGroup,
	reorganizeWarningMessage,
	rowTintForItem,
	stepUnits,
	toSubmitGroups,
	toUiGroups,
	visibleGroupCount,
	type GroupItemView
} from './groupsState';
import { orderByPerson, persistedGroupItems } from './detailGroups';
import { editableGroupItems, groupsSignature } from './editGroups';
import { primaryFooterNote, primaryNote } from './primaryNote';
import { applyWizardGroupsChange, orderWizardRows, wizardGroupItems } from './wizardGroups';

const frameItem: GroupItemView = {
	id: 'f1',
	itemType: SaleItemType.PRODUCT,
	quantity: 2,
	productType: ProductType.FRAME,
	name: 'Palazzo C1'
};
const lensItem: GroupItemView = {
	id: 'l1',
	itemType: SaleItemType.LENS_PAIR,
	quantity: 1,
	name: 'CR39 Blue'
};

describe('groupsState', () => {
	it('cycles palette colors and builds initials', () => {
		expect(personColor(0)).toEqual(personColor(6));
		expect(personColor(-1)).toEqual(personColor(5));
		expect(personInitials('Sofía (hija)', 0)).toBe('SH');
		expect(personInitials('Ana', 0)).toBe('AN');
		expect(personInitials('  ', 1)).toBe('T2');
		expect(personInitials(null, 0)).toBe('T1');
	});

	it('creates, converts, mutates, counts and clamps UiGroups', () => {
		const g1 = newUiGroup('Ana');
		const g2 = newUiGroup(null);
		let groups = assignWhole([g1, g2], 0, lensItem);
		expect(memberQty(groups[0], 'l1')).toBe(1);
		expect(memberQty(undefined, 'l1')).toBe(0);

		groups = assignWhole(groups, null, lensItem);
		expect(memberQty(groups[0], 'l1')).toBe(0);

		groups = stepUnits(groups, 0, frameItem, 1);
		groups = stepUnits(groups, 1, frameItem, 1);
		expect(groupUnits(groups[0])).toBe(1);
		expect(visibleGroupCount(groups)).toBe(2);
		expect(groupLabel(groups, 0)).toBe('Ana');
		expect(groupLabel(groups, 1)).toBe('Trabajo 2');

		const renamed = renameGroup(groups, g2.key, 'Bob');
		expect(renamed[1].label).toBe('Bob');

		const withLens = assignWhole(renamed, 0, lensItem);
		expect(groupLensIds(withLens[0], [frameItem, lensItem])).toEqual(['l1']);

		const removed = removeGroup(withLens, g2.key);
		expect(removed).toHaveLength(1);

		const submitted = toSubmitGroups(withLens);
		expect(submitted).toHaveLength(2);
		expect(toUiGroups(submitted)[0].label).toBe('Ana');
		expect(clampUiGroups(withLens, [lensItem])[0].members).toEqual([{ itemId: 'l1', quantity: 1 }]);
	});

	it('computes row tint and reorganize warning messages', () => {
		const g1 = { label: 'Ana', members: [{ itemId: 'f1', quantity: 1 }] };
		const g2 = { label: 'Bob', members: [{ itemId: 'f1', quantity: 1 }] };

		expect(rowTintForItem(undefined, [g1])).toBeNull();
		expect(rowTintForItem(frameItem, [])).toBeNull();
		expect(rowTintForItem(lensItem, [g1])).toBeNull();
		expect(rowTintForItem(frameItem, [g1])?.accent).toBe(personColor(0).dot);
		expect(rowTintForItem(frameItem, [g1, g2])?.accent).toBe('#2563eb');

		expect(reorganizeWarningMessage('sale', [], '#0230')).toBeUndefined();
		expect(reorganizeWarningMessage('sale', [g1, g2], '#0230')).toContain('Esta venta');
		expect(reorganizeWarningMessage('sale', [g1, g2], '#0230')).toContain('230-1, 230-2');
		expect(reorganizeWarningMessage('quote', [g1], 'P-0055')).toContain('Este presupuesto');
		expect(reorganizeWarningMessage('quote', [g1])).toContain('identificadores asignados.');
	});
});

describe('detailGroups', () => {
	it('maps persisted lines including product name fallback and reorders by person', () => {
		const lines = [
			{
				id: 'f1',
				itemType: SaleItemType.PRODUCT,
				quantity: 1,
				snapshotName: null,
				product: { name: 'Kit Palazzo', type: ProductType.ACCESSORY },
				parentSaleItemId: null
			},
			{
				id: 'l1',
				itemType: SaleItemType.LENS_PAIR,
				quantity: 1,
				snapshotName: null,
				lensCatalogItem: { name: 'CR39' },
				parentSaleItemId: null
			},
			{
				id: 'fr1',
				itemType: SaleItemType.FREE_ITEM,
				quantity: 1,
				snapshotName: null,
				freeDetails: { description: 'Ajuste' },
				parentSaleItemId: null
			},
			{
				id: 'unk',
				itemType: SaleItemType.PRODUCT,
				quantity: 1,
				snapshotName: null,
				parentSaleItemId: null
			}
		];
		const views = persistedGroupItems(lines, (l) => l.parentSaleItemId);
		expect(views.map((v) => v.name)).toEqual(['Kit Palazzo', 'CR39', 'Ajuste', 'Artículo']);

		expect(orderByPerson(lines, (l) => l.id, views, [])).toEqual(lines);
		const ordered = orderByPerson(
			[
				...lines,
				{ id: 'extra', itemType: 'PRODUCT', quantity: 1, snapshotName: 'X', parentSaleItemId: null }
			],
			(l) => l.id,
			views,
			[
				{
					label: 'Ana',
					members: [
						{ itemId: 'l1', quantity: 1 },
						{ itemId: 'f1', quantity: 1 }
					]
				}
			]
		);
		expect(ordered[0].id).toBe('l1');
		expect(ordered[1].id).toBe('f1');
		expect(ordered.at(-1)?.id).toBe('extra');
	});
});

describe('editGroups', () => {
	it('maps active editable items and computes a stable signature', () => {
		const editable: EditableItem[] = [
			{
				id: 'p1',
				itemType: SaleItemType.PRODUCT,
				productId: 'prod-1',
				quantity: 1,
				unitPrice: 10,
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotName: 'Montura A'
			},
			{
				id: 'l1',
				itemType: SaleItemType.LENS_PAIR,
				quantity: 1,
				unitPrice: 20,
				discount: 0,
				discountType: DiscountType.FIXED
			},
			{
				id: 'f1',
				itemType: SaleItemType.FREE_ITEM,
				quantity: 1,
				unitPrice: 5,
				discount: 0,
				discountType: DiscountType.FIXED,
				freeItemDescription: 'Servicio'
			},
			{
				id: 'gone',
				itemType: SaleItemType.PRODUCT,
				quantity: 1,
				unitPrice: 5,
				discount: 0,
				discountType: DiscountType.FIXED,
				_removed: true
			}
		];
		const types = new Map<string, string | null>([['prod-1', ProductType.FRAME]]);
		const views = editableGroupItems(editable, types);
		expect(views).toHaveLength(3);
		expect(views.map((v) => v.name)).toEqual(['Montura A', 'Cristales', 'Servicio']);
		expect(views[0].productType).toBe(ProductType.FRAME);
		expect(groupsSignature([{ label: 'Ana', members: [{ itemId: 'p1', quantity: 1 }] }])).toBe(
			'Ana: p1 ×1'
		);
	});
});

describe('primaryNote', () => {
	it('formats notes for no lenses, no primary, named group, and fallback lens', () => {
		expect(primaryNote([frameItem], [], null)).toContain('Sin cristales');
		expect(primaryFooterNote([frameItem], [], null)).toBeUndefined();
		expect(primaryNote([lensItem], [], null)).toContain('Sin fórmula principal');
		expect(
			primaryNote([lensItem], [{ label: 'Ana', members: [{ itemId: 'l1', quantity: 1 }] }], 'l1')
		).toContain('Ana');
		expect(primaryNote([lensItem], [], 'l1')).toContain('CR39 Blue');
		expect(primaryFooterNote([lensItem], [], 'l1')).toBe('★ Fórmula del cliente: CR39 Blue');
	});
});

describe('wizardGroups', () => {
	it('builds views, reorders rows and mirrors frame split onto included accessories', () => {
		const products = [
			{ id: 'prod-f', name: 'Palazzo', type: ProductType.FRAME },
			{ id: 'prod-a', name: 'Estuche', type: ProductType.ACCESSORY }
		] as unknown as ProductWithRelations[];
		const lenses = [{ id: 'cat-l', name: 'CR39' }] as unknown as LensCatalogItemWithRelations[];

		const rows = [
			{
				id: 'a1',
				kind: 'product',
				productId: 'prod-a',
				quantity: 2,
				unitPrice: 0,
				discount: 0,
				discountType: DiscountType.FIXED,
				notes: '',
				isIncludedAccessory: true,
				includedAccessoryParentItemId: 'f1'
			},
			{
				id: 'l1',
				kind: 'lens',
				lensPair: { catalogItemId: 'cat-l' },
				quantity: 1,
				unitPrice: 50,
				discount: 0,
				discountType: DiscountType.FIXED,
				notes: '',
				isIncludedAccessory: false,
				includedAccessoryParentItemId: null
			},
			{
				id: 't1',
				kind: 'treatment',
				parentLensItemId: 'l1',
				supplierTreatmentId: 'st-1',
				treatmentName: 'AR',
				treatmentCategory: 'AR',
				quantity: 2,
				unitPrice: 10,
				purchasePrice: 5,
				costOverride: undefined,
				discount: 0,
				discountType: DiscountType.FIXED,
				isTaxable: false,
				notes: '',
				isIncludedAccessory: false,
				includedAccessoryParentItemId: null
			},
			{
				id: 'fr1',
				kind: 'free',
				freeItem: { description: 'Ajuste', category: 'SERVICE' },
				quantity: 1,
				unitPrice: 10,
				discount: 0,
				discountType: DiscountType.FIXED,
				notes: '',
				isIncludedAccessory: false,
				includedAccessoryParentItemId: null
			},
			{
				id: 'f1',
				kind: 'product',
				productId: 'prod-f',
				quantity: 2,
				unitPrice: 80,
				discount: 0,
				discountType: DiscountType.FIXED,
				notes: '',
				isIncludedAccessory: false,
				includedAccessoryParentItemId: null
			}
		] as unknown as SaleItemRow[];

		const views = wizardGroupItems(rows, products, lenses);
		expect(views.map((v) => v.name)).toEqual(['Estuche', 'CR39', 'AR', 'Ajuste', 'Palazzo']);

		const prev = [
			{ label: 'Ana', members: [] },
			{ label: 'Bob', members: [] }
		];
		const next = [
			{
				label: 'Ana',
				members: [
					{ itemId: 'f1', quantity: 1 },
					{ itemId: 'l1', quantity: 1 }
				]
			},
			{ label: 'Bob', members: [{ itemId: 'f1', quantity: 1 }] }
		];
		const mirrored = applyWizardGroupsChange(prev, next, views, { f1: ['a1'] });
		expect(mirrored[0].members).toContainEqual({ itemId: 'a1', quantity: 1 });
		expect(mirrored[1].members).toContainEqual({ itemId: 'a1', quantity: 1 });

		// Unchanged frame allocation leaves accessories untouched
		expect(applyWizardGroupsChange(mirrored, mirrored, views, { f1: ['a1'] })).toEqual(mirrored);

		const ordered = orderWizardRows(rows, views, mirrored);
		expect(ordered.map((r) => r.id)).toEqual(['f1', 'l1', 't1', 'a1', 'fr1']);
		expect(orderWizardRows(ordered, views, mirrored).map((r) => r.id)).toEqual(
			ordered.map((r) => r.id)
		);
	});
});
