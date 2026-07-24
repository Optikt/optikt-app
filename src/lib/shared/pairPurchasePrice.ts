import { LensPriceType } from '$lib/shared/enums';

/**
 * Precio de compra siempre por par.
 * - UNIT: base_price × 2
 * - PAIR: base_price
 *
 * mounting_price y shipping_price NUNCA se incluyen ni se multiplican
 * en este cálculo. Este valor representa el costo puro del par de cristales
 * y es usado para márgenes, órdenes de compra y snapshots de ventas.
 */
export function computePairPurchasePrice(basePrice: number, priceType: string): number {
	return priceType === LensPriceType.UNIT ? basePrice * 2 : basePrice;
}
