import type { LensSaleItemRow, SaleItemRow } from '../../newSaleTypes';

export function copyFirstRxToAll(items: SaleItemRow[]) {
	const firstLens = items.find((i): i is LensSaleItemRow => i.kind === 'lens');
	if (!firstLens) return;
	const src = firstLens.lensPair;
	for (const item of items) {
		if (item.kind !== 'lens' || !item.lensPair || item.id === firstLens.id) continue;
		const dest = item.lensPair;
		dest.od.prescription = { ...src.od.prescription };
		dest.oi.prescription = { ...src.oi.prescription };
		dest.od.dp = src.od.dp;
		dest.od.np = src.od.np;
		dest.od.altura = src.od.altura;
		dest.oi.dp = src.oi.dp;
		dest.oi.np = src.oi.np;
		dest.oi.altura = src.oi.altura;
		dest.lensType = src.lensType;
		dest.doctorName = src.doctorName;
	}
}
