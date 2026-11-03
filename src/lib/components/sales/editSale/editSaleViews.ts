import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { EditableItem } from '../editSaleDraft';

/** Which editor shell is open in the item view (agnostic to the editor data). */
export type EditorKind = 'lens' | 'product' | 'free';

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ─ ─ * */
/** Editor shell that opens an item (list rows / placeholder creation). */
export function editorKindFor(item: EditableItem): EditorKind {
	if (item.itemType === SaleItemType.LENS_PAIR) return 'lens';
	if (item.itemType === SaleItemType.FREE_ITEM) return 'free';
	return 'product';
}
