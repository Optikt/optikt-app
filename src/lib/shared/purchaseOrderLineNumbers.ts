export type PurchaseOrderLineNumbered<T> = T & {
	lineNumber: number;
};

export function assignPurchaseOrderLineNumbers<T>(
	items: readonly T[]
): PurchaseOrderLineNumbered<T>[] {
	return items.map((item, index) => ({
		...item,
		lineNumber: index + 1
	}));
}
