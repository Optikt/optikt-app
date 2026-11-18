/**
 * Clasificación pura del preview de conversión (stock + precio) — la UI la usa
 * en dos lugares: el bloque "Si se convierte hoy" del hero y la sección
 * "Revisión" del modal de conversión. La misma query alimenta ambos.
 *
 * Política de stock: EXACTAMENTE la misma de crear una venta nueva hoy
 * (`consumeFifoForSaleItem`): PRODUCT con stock insuficiente falla al
 * convertir; lente en modo STOCK con stock insuficiente falla; lo demás no
 * controla stock. Aquí solo se clasifica para avisar — la conversión no
 * bloquea por stock si la venta nueva tampoco bloquea al crearla.
 */

import { LensInventoryMode, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { QuoteItem } from '$lib/server/db/schema';

export type StockKind = 'ok' | 'insufficient' | 'untracked';

export interface ConversionPreviewItem {
	quoteItemId: string;
	label: string;
	stock: {
		kind: StockKind;
		available?: number;
		needed: number;
	};
	price: {
		/** Precio presupuestado (unitPrice del ítem). */
		quoted: number;
		/** Precio vigente en catálogo; null = sin comparación (ítem libre). */
		current: number | null;
		changed: boolean;
	};
}

export interface QuoteConversionSummary {
	allStockOk: boolean;
	priceChangedCount: number;
	missingCustomer: boolean;
}

export interface QuoteConversionPreview {
	items: ConversionPreviewItem[];
	summary: QuoteConversionSummary;
}

/** Tolerancia para "precio cambió" (centavos flotantes). */
const PRICE_EPSILON = 0.001;

export interface ConversionCatalogEntry {
	currentSalePrice?: number | null;
	stock?: number | null;
	inventoryMode?: string | null;
}

export interface QuoteConversionItemRow {
	item: QuoteItem;
	/** Etiqueta del ítem: snapshotName → nombre del producto/lente/tratamiento. */
	label: string;
	/** Por productId (PRODUCT) — precio vigente y stock del catálogo. */
	product: ConversionCatalogEntry | null;
	/** Por lensCatalogItemId (LENS_PAIR) — precio y modo de inventario del lente. */
	lens: ConversionCatalogEntry | null;
	/** Por supplierTreatmentId (TREATMENT) — precio vigente del tratamiento. */
	treatment: ConversionCatalogEntry | null;
}

function lensSalePrice(
	lens: ConversionCatalogEntry & {
		pairPurchasePrice?: number;
		mountingPrice?: number;
		shippingPrice?: number;
	}
): number | null {
	if (lens.currentSalePrice != null && lens.currentSalePrice > 0) return lens.currentSalePrice;
	if (lens.pairPurchasePrice == null) return null;
	return lens.pairPurchasePrice + (lens.mountingPrice ?? 0) + (lens.shippingPrice ?? 0);
}

function classifyItem(row: QuoteConversionItemRow): ConversionPreviewItem {
	const { item, label, product, lens, treatment } = row;
	const quoted = item.unitPrice;
	const needed = item.quantity;

	let stock: ConversionPreviewItem['stock'] = { kind: 'untracked' as StockKind, needed };
	let current: number | null = null;

	if (item.itemType === SaleItemType.PRODUCT && product) {
		const available = product.stock ?? 0;
		stock =
			available >= needed
				? { kind: 'ok', available, needed }
				: { kind: 'insufficient', available, needed };
		current = product.currentSalePrice ?? null;
	} else if (item.itemType === SaleItemType.LENS_PAIR && lens) {
		if (lens.inventoryMode === LensInventoryMode.STOCK) {
			const available = lens.stock ?? 0;
			stock =
				available >= needed
					? { kind: 'ok', available, needed }
					: { kind: 'insufficient', available, needed };
		}
		current = lensSalePrice(lens);
	} else if (item.itemType === SaleItemType.TREATMENT && treatment) {
		current = treatment.currentSalePrice ?? null;
	}

	return {
		quoteItemId: item.id,
		label,
		stock,
		price: {
			quoted,
			current,
			changed: current !== null && Math.abs(current - quoted) > PRICE_EPSILON
		}
	};
}

/** Clasifica los ítems del presupuesto y arma el resumen del preview. */
export function buildQuoteConversionPreview(
	rows: QuoteConversionItemRow[],
	{ hasCustomer }: { hasCustomer: boolean }
): QuoteConversionPreview {
	const items = rows.map(classifyItem);
	const priceChangedCount = items.filter((i) => i.price.changed).length;
	const allStockOk = items.every((i) => i.stock.kind !== 'insufficient');

	return {
		items,
		summary: {
			allStockOk,
			priceChangedCount,
			missingCustomer: !hasCustomer
		}
	};
}
