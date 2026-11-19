/** Helpers puros del drawer de edición (extraídos de EditSaleModal para el gate de tamaño). */
import { toast } from 'svelte-sonner';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { SALE_CAPABILITIES } from '$lib/components/documentEditor/types';
import { validateEditSale } from '../editSaleValidation';
import { seedCatalogCacheForItems, type EditableItem } from '../editSaleDraft';
import { logger } from '$lib/utils';

// ── Measures de montaje (solo ventas) ──────────────────────────────────────
export type Measures = {
	odDp: number | null;
	osDp: number | null;
	odDnp: number | null;
	osDnp: number | null;
};

export const EMPTY_MEASURES: Measures = {
	odDp: null,
	osDp: null,
	odDnp: null,
	osDnp: null
};

export function measuresFromSeed(
	seed: {
		dp?: number | null;
		npRight?: number | null;
		npLeft?: number | null;
	} | null
): Measures {
	return {
		odDp: seed?.dp ?? null,
		osDp: seed?.dp ?? null,
		odDnp: seed?.npRight ?? null,
		osDnp: seed?.npLeft ?? null
	};
}

export function measuresChanged(
	measures: Measures,
	seed: { dp?: number | null; npRight?: number | null; npLeft?: number | null } | null
): boolean {
	return (
		measures.odDp !== (seed?.dp ?? null) ||
		measures.odDnp !== (seed?.npRight ?? null) ||
		measures.osDnp !== (seed?.npLeft ?? null)
	);
}

// ── Alta/baja/restauración de ítems ───────────────────────────────────────
/** Placeholders (sin id de servidor) desaparecen; los persistidos quedan restaurables. */
export function removeEditableItem(items: EditableItem[], item: EditableItem): EditableItem[] {
	// Sin id no puede tener hijos: comparar `parentSaleItemId !== undefined` borraba
	// también todos los ítems de nivel superior (su parentSaleItemId es undefined).
	if (!item.id) return items.filter((i) => i !== item);
	const targetId = item.id;
	item._removed = true;
	if (item.itemType === SaleItemType.LENS_PAIR) {
		for (const child of items) {
			if (child.parentSaleItemId === targetId) child._removed = true;
		}
	}
	return [...items];
}

export function restoreEditableItem(items: EditableItem[], item: EditableItem): EditableItem[] {
	item._removed = false;
	for (const child of items) {
		if (child.parentSaleItemId === item.id) child._removed = false;
	}
	return [...items];
}

export function removeEditableChild(items: EditableItem[], child: EditableItem): EditableItem[] {
	child._removed = true;
	return [...items];
}

/** Validación antes de guardar; ya emite el toast de error correspondiente. */
export function validateEditModal(input: {
	editingId: string | null;
	mode: 'sale' | 'quote';
	activeItems: EditableItem[];
	reason: string;
}): { valid: boolean; reasonError: string } {
	if (input.editingId) {
		toast.error('Termina de editar el artículo abierto con «Hecho ✓».');
		return { valid: false, reasonError: '' };
	}
	if (input.mode === 'quote') {
		if (input.activeItems.length === 0) {
			toast.error('El presupuesto debe tener al menos un artículo');
			return { valid: false, reasonError: '' };
		}
		return { valid: true, reasonError: '' };
	}
	const result = validateEditSale(input.reason, input.activeItems, {
		requireReason: SALE_CAPABILITIES.requiredReason
	});
	if (!result.valid && !result.reasonError) {
		toast.error('La venta debe tener al menos un artículo');
	}
	return result;
}

/** Precarga el catálogo de cristales del drawer; fallo no bloqueante (solo log). */
export function seedCatalogCacheLogged(
	items: Parameters<typeof seedCatalogCacheForItems>[0],
	kind: 'sale' | 'quote'
): void {
	void seedCatalogCacheForItems(items).catch((error) =>
		logger.error(`No se pudo cargar el catálogo de cristales del ${kind}`, error)
	);
}
