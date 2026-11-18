/**
 * Adapter quote → presentación compartida con ventas.
 *
 * La tabla de ítems del detalle de presupuesto es `SaleItemsTable` en solo
 * lectura: el adapter mapea `QuoteItemWithDetails` a la forma que consumen
 * `itemDisplay` / `SaleItemsRow` / `LensRxPanel`. Los campos que solo existen
 * en sale_items (lote FIFO, prescripción vinculada, medidas DP/NP snapshot,
 * costos calculados por FIFO) se rellenan en null/false — un presupuesto no
 * consume inventario ni mide montaje.
 */

import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import { buildPersistedDisplayGroups } from '$lib/components/sales/helpers/items';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { DisplayGroup } from '$lib/components/sales/itemsTable/itemDisplay';

export function quoteItemToDisplayItem(
	item: QuoteItemWithDetails,
	quoteId: string
): SaleItemWithDetails {
	return {
		...item,
		saleId: quoteId,
		// Campos exclusivos de sale_items: el presupuesto no los tiene (null).
		lotId: null,
		prescriptionId: null,
		dp: null,
		npRight: null,
		npLeft: null,
		snapshotCostTotal: null,
		snapshotCostUnit: null,
		snapshotLotsCount: null,
		shippingCostPending: false
	} as unknown as SaleItemWithDetails;
}

/** Grupos de display (lente + tratamientos hijos, productos, ítems libres). */
export function buildQuoteDisplayGroups(
	items: QuoteItemWithDetails[],
	quoteId: string
): DisplayGroup[] {
	const displayItems = items.map((item) => quoteItemToDisplayItem(item, quoteId));
	const mainItems = displayItems.filter((i) => i.itemType !== SaleItemType.TREATMENT);
	return buildPersistedDisplayGroups(
		displayItems,
		mainItems,
		SaleItemType.LENS_PAIR,
		SaleItemType.TREATMENT,
		(item) => (item as unknown as QuoteItemWithDetails).parentQuoteItemId
	);
}
