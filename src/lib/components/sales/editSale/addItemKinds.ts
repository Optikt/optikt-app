import { DiscountType } from '$lib/shared/enums';
import { ALL_FREE_ITEM_CATEGORIES, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { EditableItem } from '../editSaleDraft';
import { Eye, Glasses, Tag } from '@lucide/svelte';

export const ADD_ITEM_KINDS = [
	{
		kind: 'lens',
		label: 'Cristal',
		hint: 'Receta y tratamientos',
		icon: Eye
	},
	{
		kind: 'product',
		label: 'Producto',
		hint: 'Montura o accesorio del inventario',
		icon: Glasses
	},
	{
		kind: 'free',
		label: 'Ítem libre',
		hint: 'Servicio o fórmula, sin inventario',
		icon: Tag
	}
] as const;

export type AddItemKind = (typeof ADD_ITEM_KINDS)[number]['kind'];

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ─ ─ ─ * *
 * Placeholder item joined to the basket when «Agregar» opens an editor;
 * commits reuse the local id (same convention as the lens Apply). */
export function createPlaceholder(kind: AddItemKind): EditableItem {
	const base = {
		id: crypto.randomUUID(),
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		_removed: false
	};
	if (kind === 'lens') return { ...base, itemType: SaleItemType.LENS_PAIR };
	if (kind === 'product') return { ...base, itemType: SaleItemType.PRODUCT };
	return {
		...base,
		itemType: SaleItemType.FREE_ITEM,
		freeItemCategory: ALL_FREE_ITEM_CATEGORIES[0]
	};
}
