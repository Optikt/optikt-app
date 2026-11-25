import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '$lib/shared/enums/roles';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import type { ActionContext } from '$lib/server/actionContext';

const findQuoteById = vi.fn();
const findQuoteGroupableItems = vi.fn();
const findQuoteItemGroups = vi.fn();
const lockQuoteForGroups = vi.fn();
const replaceQuoteItemGroups = vi.fn();
const logCustom = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: { transaction: (fn: (tx: unknown) => Promise<unknown>) => fn('tx') }
}));
vi.mock('$lib/server/db/queries/quotes/reads', () => ({
	findQuoteById: (id: string) => findQuoteById(id)
}));
vi.mock('$lib/server/db/queries/quotes/itemGroups', () => ({
	findQuoteGroupableItems: (id: string, tx?: unknown) => findQuoteGroupableItems(id, tx),
	findQuoteItemGroups: (id: string, tx?: unknown) => findQuoteItemGroups(id, tx),
	lockQuoteForGroups: (id: string, tx?: unknown) => lockQuoteForGroups(id, tx),
	replaceQuoteItemGroups: (...a: unknown[]) => replaceQuoteItemGroups(...a)
}));
vi.mock('$lib/server/audit', () => ({
	auditService: { logCustom: (...a: unknown[]) => logCustom(...a) }
}));

const { saveQuoteItemGroupsCore } = await import('./saveQuoteItemGroups');

const ctx: ActionContext = {
	userId: 'u-1',
	role: UserRole.ADMIN,
	ipAddress: '127.0.0.1',
	userAgent: 'vitest'
};
const itemId = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
	for (const fn of [
		findQuoteById,
		findQuoteGroupableItems,
		findQuoteItemGroups,
		lockQuoteForGroups,
		replaceQuoteItemGroups,
		logCustom
	]) {
		fn.mockReset();
	}
	lockQuoteForGroups.mockResolvedValue({ status: QuoteStatus.DRAFT });
});

describe('saveQuoteItemGroupsCore', () => {
	it('rejects VIEWER role', async () => {
		const res = await saveQuoteItemGroupsCore(
			{ quoteId, groups: [] },
			{ ...ctx, role: UserRole.VIEWER }
		);
		expect(res.success).toBe(false);
		expect(findQuoteById).not.toHaveBeenCalled();
	});

	it('returns not found when quote does not exist', async () => {
		findQuoteById.mockResolvedValue(null);
		await expect(saveQuoteItemGroupsCore({ quoteId, groups: [] }, ctx)).resolves.toEqual({
			success: false,
			error: 'Presupuesto no encontrado'
		});
	});

	it('rejects quotes that are no longer in DRAFT', async () => {
		findQuoteById.mockResolvedValue({ id: quoteId, status: QuoteStatus.CONVERTED });
		const res = await saveQuoteItemGroupsCore({ quoteId, groups: [] }, ctx);
		expect(res.success).toBe(false);
	});

	it('rejects if quote left DRAFT concurrently before acquiring lock', async () => {
		findQuoteById.mockResolvedValue({ id: quoteId, status: QuoteStatus.DRAFT });
		lockQuoteForGroups.mockResolvedValue({ status: QuoteStatus.CONVERTED });
		const res = await saveQuoteItemGroupsCore({ quoteId, groups: [] }, ctx);
		expect(res.success).toBe(false);
		expect(replaceQuoteItemGroups).not.toHaveBeenCalled();
	});

	it('rejects invalid group allocations', async () => {
		findQuoteById.mockResolvedValue({ id: quoteId, status: QuoteStatus.DRAFT });
		findQuoteGroupableItems.mockResolvedValue([
			{ id: itemId, itemType: 'PRODUCT', quantity: 1, parentId: null, snapshotName: 'Montura' }
		]);
		findQuoteItemGroups.mockResolvedValue([]);

		const res = await saveQuoteItemGroupsCore(
			{ quoteId, groups: [{ label: 'Ana', members: [{ itemId, quantity: 2 }] }] },
			ctx
		);
		expect(res.success).toBe(false);
		expect(replaceQuoteItemGroups).not.toHaveBeenCalled();
	});

	it('persists normalized groups and logs audit when changed', async () => {
		findQuoteById.mockResolvedValue({ id: quoteId, status: QuoteStatus.DRAFT });
		findQuoteGroupableItems.mockResolvedValue([
			{ id: itemId, itemType: 'PRODUCT', quantity: 1, parentId: null, snapshotName: 'Montura' }
		]);
		findQuoteItemGroups.mockResolvedValue([]);

		const res = await saveQuoteItemGroupsCore(
			{ quoteId, groups: [{ label: '  Ana  ', members: [{ itemId, quantity: 1 }] }] },
			ctx
		);
		expect(res).toEqual({
			success: true,
			groups: [{ label: 'Ana', members: [{ itemId, quantity: 1 }] }]
		});
		expect(replaceQuoteItemGroups).toHaveBeenCalledWith(
			quoteId,
			[{ label: 'Ana', members: [{ itemId, quantity: 1 }] }],
			'tx'
		);
		expect(logCustom).toHaveBeenCalledTimes(1);
	});

	it('skips audit when groups summary did not change', async () => {
		findQuoteById.mockResolvedValue({ id: quoteId, status: QuoteStatus.DRAFT });
		findQuoteGroupableItems.mockResolvedValue([
			{ id: itemId, itemType: 'PRODUCT', quantity: 1, parentId: null, snapshotName: null }
		]);
		findQuoteItemGroups.mockResolvedValue([{ label: 'Ana', members: [{ itemId, quantity: 1 }] }]);

		const res = await saveQuoteItemGroupsCore(
			{ quoteId, groups: [{ label: 'Ana', members: [{ itemId, quantity: 1 }] }] },
			ctx
		);
		expect(res.success).toBe(true);
		expect(logCustom).not.toHaveBeenCalled();
	});

	it('logs audit when two identically-named items swap between people', async () => {
		const itemB = '33333333-3333-4333-8333-333333333333';
		findQuoteById.mockResolvedValue({ id: quoteId, status: QuoteStatus.DRAFT });
		findQuoteGroupableItems.mockResolvedValue([
			{ id: itemId, itemType: 'LENS_PAIR', quantity: 1, parentId: null, snapshotName: 'CR-39' },
			{ id: itemB, itemType: 'LENS_PAIR', quantity: 1, parentId: null, snapshotName: 'CR-39' }
		]);
		findQuoteItemGroups.mockResolvedValue([
			{ label: 'Sofía', members: [{ itemId, quantity: 1 }] },
			{ label: 'Andrés', members: [{ itemId: itemB, quantity: 1 }] }
		]);

		const res = await saveQuoteItemGroupsCore(
			{
				quoteId,
				groups: [
					{ label: 'Sofía', members: [{ itemId: itemB, quantity: 1 }] },
					{ label: 'Andrés', members: [{ itemId, quantity: 1 }] }
				]
			},
			ctx
		);
		expect(res.success).toBe(true);
		expect(logCustom).toHaveBeenCalledTimes(1);
	});
});
