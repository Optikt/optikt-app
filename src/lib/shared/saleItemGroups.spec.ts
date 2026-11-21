import { describe, expect, it } from 'vitest';
import {
	assignedQty,
	chipModel,
	clampAllocations,
	clearLabels,
	defaultPrimaryLens,
	dropEmptyGroups,
	followIncludedAccessories,
	groupDisplayLabel,
	normalizeGroupsForSubmit,
	orderItemsByGroups,
	remainingQty,
	remapGroupItemIds,
	setMemberQuantity,
	summarizeGroups,
	validateItemGroups,
	type GroupableItem,
	type ItemGroup
} from './saleItemGroups';

const frame2: GroupableItem = { id: 'f', itemType: 'PRODUCT', quantity: 2, productType: 'FRAME' };
const frameB: GroupableItem = { id: 'g', itemType: 'PRODUCT', quantity: 1, productType: 'FRAME' };
const lensA: GroupableItem = { id: 'la', itemType: 'LENS_PAIR', quantity: 1 };
const lensB: GroupableItem = { id: 'lb', itemType: 'LENS_PAIR', quantity: 1 };
const arA: GroupableItem = { id: 'ta', itemType: 'TREATMENT', quantity: 1, parentId: 'la' };
const caseAcc: GroupableItem = {
	id: 'c',
	itemType: 'PRODUCT',
	quantity: 2,
	productType: 'ACCESSORY'
};

const g = (label: string | null, members: [string, number][]): ItemGroup => ({
	label,
	members: members.map(([itemId, quantity]) => ({ itemId, quantity }))
});

describe('quantities', () => {
	const groups = [g('Sofía', [['f', 1]]), g('Andrés', [['f', 1]])];

	it('sums allocations and the remaining units', () => {
		expect(assignedQty(groups, 'f')).toBe(2);
		expect(assignedQty(groups, 'f', 0)).toBe(1);
		expect(remainingQty(frame2, groups)).toBe(0);
		expect(remainingQty(frame2, [g(null, [['f', 1]])])).toBe(1);
	});

	it('setMemberQuantity clamps to what other groups leave free', () => {
		const next = setMemberQuantity([g('A', [['f', 1]]), g('B', [])], 1, frame2, 5);
		expect(next[1].members).toEqual([{ itemId: 'f', quantity: 1 }]);
		expect(setMemberQuantity(next, 1, frame2, 0)[1].members).toEqual([]);
	});

	it('clampAllocations trims from the last group and drops removed/non-groupable items', () => {
		const lower = { ...frame2, quantity: 1 };
		const clamped = clampAllocations(
			[
				g('A', [
					['f', 1],
					['ta', 1]
				]),
				g('B', [
					['f', 1],
					['gone', 1]
				])
			],
			[lower, arA]
		);
		expect(clamped[0].members).toEqual([{ itemId: 'f', quantity: 1 }]);
		expect(clamped[1].members).toEqual([]);
		expect(dropEmptyGroups(clamped)).toHaveLength(1);
	});
});

describe('labels', () => {
	it('falls back to "Trabajo N"', () => {
		expect(groupDisplayLabel('  ', 1)).toBe('Trabajo 2');
		expect(groupDisplayLabel(' Sofía ', 0)).toBe('Sofía');
	});

	it('clearLabels keeps the pairing', () => {
		const cleared = clearLabels([g('Sofía', [['la', 1]])]);
		expect(cleared[0]).toEqual(g(null, [['la', 1]]));
	});

	it('normalizeGroupsForSubmit trims, nulls empty labels and drops empty groups', () => {
		expect(normalizeGroupsForSubmit([g(' ', [['f', 1]]), g('X', [])])).toEqual([
			{ label: null, members: [{ itemId: 'f', quantity: 1 }] }
		]);
	});
});

describe('chipModel', () => {
	it('none / single / multi with free units', () => {
		expect(chipModel(frame2, []).text).toBe('Sin asignar');
		expect(chipModel(frame2, [g('Sofía', [['f', 2]])]).text).toBe('Sofía');
		const multi = chipModel(frame2, [g('Sofía', [['f', 1]]), g(null, [['f', 1]])]);
		expect(multi.state).toBe('multi');
		expect(multi.text).toBe('2 personas');
		expect(multi.detail).toEqual(['1 · Sofía', '1 · Trabajo 2']);
		const partial = chipModel(frame2, [g('Sofía', [['f', 1]])]);
		expect(partial.text).toBe('Sofía · 1 libre');
		expect(partial.detail).toEqual(['1 · Sofía', '1 · sin asignar']);
	});
});

describe('defaultPrimaryLens', () => {
	it('one lens and no names → that lens', () => {
		expect(defaultPrimaryLens([frame2, lensA], [])).toBe('la');
		expect(defaultPrimaryLens([frame2, lensA], [g(null, [['la', 1]])])).toBe('la');
	});
	it('several lenses or a name typed → none', () => {
		expect(defaultPrimaryLens([lensA, lensB], [])).toBeNull();
		expect(defaultPrimaryLens([lensA], [g('Sofía', [['la', 1]])])).toBeNull();
		expect(defaultPrimaryLens([frame2], [])).toBeNull();
	});
});

describe('validateItemGroups', () => {
	const items = [frame2, lensA, arA];
	it('accepts a valid split', () => {
		expect(validateItemGroups([g('A', [['f', 1]]), g('B', [['f', 1]])], items, 'la')).toEqual([]);
	});
	it('rejects over-allocation, treatments, unknown ids and a non-lens primary', () => {
		expect(validateItemGroups([g('A', [['f', 3]])], items)).not.toEqual([]);
		expect(validateItemGroups([g('A', [['ta', 1]])], items)).not.toEqual([]);
		expect(validateItemGroups([g('A', [['zz', 1]])], items)).not.toEqual([]);
		expect(validateItemGroups([], items, 'f')).not.toEqual([]);
	});
});

describe('orderItemsByGroups', () => {
	const ids = (list: GroupableItem[]) => list.map((i) => i.id);

	it('no groups → identity', () => {
		const items = [lensA, frame2, arA];
		expect(ids(orderItemsByGroups(items, []))).toEqual(['la', 'f', 'ta']);
	});

	it('montura, cristal, montura, cristal (treatments follow their lens, accessories last)', () => {
		const items = [frameB, frame2, lensA, arA, lensB, caseAcc];
		const groups = [
			g('Sofía', [
				['la', 1],
				['c', 1],
				['g', 1]
			]),
			g('Andrés', [['lb', 1]])
		];
		// frame2 unassigned → end; Andrés only has a lens.
		expect(ids(orderItemsByGroups(items, groups))).toEqual(['g', 'la', 'ta', 'c', 'lb', 'f']);
	});

	it('shared frame ×2 appears once: "montura ×2, cristal, cristal"', () => {
		const items = [lensA, arA, lensB, frame2];
		const groups = [
			g('Sofía', [
				['f', 1],
				['la', 1]
			]),
			g('Andrés', [
				['f', 1],
				['lb', 1]
			])
		];
		expect(ids(orderItemsByGroups(items, groups))).toEqual(['f', 'la', 'ta', 'lb']);
	});
});

describe('followIncludedAccessories', () => {
	it('mirrors the frame split onto its accessories', () => {
		const groups = [
			g('A', [
				['f', 1],
				['c', 2]
			]),
			g('B', [['f', 1]])
		];
		const next = followIncludedAccessories(groups, [frame2, caseAcc], 'f', ['c']);
		expect(next[0].members).toEqual([
			{ itemId: 'f', quantity: 1 },
			{ itemId: 'c', quantity: 1 }
		]);
		expect(next[1].members).toEqual([
			{ itemId: 'f', quantity: 1 },
			{ itemId: 'c', quantity: 1 }
		]);
	});
});

describe('remap + summary', () => {
	it('translates client ids and drops unknown ones', () => {
		const next = remapGroupItemIds(
			[
				g('A', [
					['f', 1],
					['x', 1]
				])
			],
			new Map([['f', 'F1']])
		);
		expect(next[0].members).toEqual([{ itemId: 'F1', quantity: 1 }]);
	});

	it('summarizes groups for history', () => {
		expect(summarizeGroups([g(null, [['f', 1]])], () => 'Montura')).toBe('Trabajo 1: Montura ×1');
		expect(summarizeGroups([], () => '')).toBe('Sin agrupación');
	});
});
