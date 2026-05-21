import { describe, expect, it } from 'vitest';

import { assignPurchaseOrderLineNumbers } from './purchaseOrderLineNumbers';

describe('assignPurchaseOrderLineNumbers', () => {
	it('assigns a stable 1-based sequence following array order', () => {
		const items = [{ sku: 'A' }, { sku: 'B' }, { sku: 'C' }];

		const result = assignPurchaseOrderLineNumbers(items);

		expect(result).toEqual([
			{ sku: 'A', lineNumber: 1 },
			{ sku: 'B', lineNumber: 2 },
			{ sku: 'C', lineNumber: 3 }
		]);
	});

	it('returns new objects without mutating the original array entries', () => {
		const items = [{ sku: 'A' }, { sku: 'B' }];

		const result = assignPurchaseOrderLineNumbers(items);

		expect(result[0]).not.toBe(items[0]);
		expect(items).toEqual([{ sku: 'A' }, { sku: 'B' }]);
	});
});
