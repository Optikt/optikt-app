import type { SaleItemRow } from '../../newSaleTypes';
import { hasLensPrescriptionErrors } from '../../saleItemHelpers';

export function getValidationReasons(
	items: SaleItemRow[],
	getAvailableStock: (productId: string, excludeItemId?: string) => number | null
): string[] {
	const reasons: string[] = [];
	if (items.length === 0) {
		reasons.push('Agregue al menos un producto o cristal desde la búsqueda superior');
	}

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const num = i + 1;
		if (item.kind === 'product' && item.productId && item.quantity <= 0) {
			reasons.push(`Ítem #${num}: cantidad debe ser mayor a 0`);
		}
		if (item.kind === 'lens') {
			if (!item.lensPair?.od.enabled && !item.lensPair?.oi.enabled) {
				reasons.push(`Ítem #${num}: habilite al menos un ojo`);
			}
			if (hasLensPrescriptionErrors(item)) {
				reasons.push(`Ítem #${num}: complete los campos de prescripción requeridos`);
			}
		}
		if (item.kind === 'product' && item.productId) {
			const availableStock = getAvailableStock(item.productId, item.id);
			if (availableStock !== null && (availableStock <= 0 || item.quantity > availableStock)) {
				reasons.push(`Ítem #${num}: stock insuficiente (disponible: ${availableStock})`);
			}
		}
		if (item.kind === 'free') {
			if (!item.freeItem?.category) {
				reasons.push(`Ítem #${num}: seleccione una categoría para el ítem libre`);
			}
			if (!item.freeItem?.description || item.freeItem.description.trim().length < 3) {
				reasons.push(`Ítem #${num}: ingrese una descripción (mínimo 3 caracteres)`);
			}
			if (item.unitPrice <= 0) {
				reasons.push(`Ítem #${num}: el precio de venta debe ser mayor a 0`);
			}
		}
	}
	return reasons;
}
