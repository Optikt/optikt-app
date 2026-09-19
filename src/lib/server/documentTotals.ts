import { toSaleTotalsLine } from '$lib/remote/quotes/helpers';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import type { DiscountType } from '$lib/shared/enums';

interface DocumentTotalsItem {
	unitPrice: number;
	quantity: number;
	discount: number;
	discountType: string;
	snapshotIsTaxable?: boolean | null;
	itemType: string;
}

export function computeDocumentTotals(
	items: DocumentTotalsItem[],
	discount: number,
	discountType: DiscountType,
	taxRate: number
) {
	return computeSaleTotals(
		items.map((item) => toSaleTotalsLine(item, taxRate)),
		discount,
		discountType
	);
}
