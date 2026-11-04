import type { EditableItem } from './editSaleDraft';

export function validateEditSale(
	reason: string,
	activeItems: EditableItem[],
	options: { requireReason?: boolean } = {}
): { valid: boolean; reasonError: string } {
	const requireReason = options.requireReason ?? true;
	if (requireReason && !reason.trim()) {
		return { valid: false, reasonError: 'El motivo de la modificación es obligatorio' };
	}
	if (activeItems.length === 0) {
		return { valid: false, reasonError: '' };
	}
	return { valid: true, reasonError: '' };
}

export function validateActiveItemsNotEmpty(activeItems: EditableItem[]): string | null {
	if (activeItems.length === 0) return 'La venta debe tener al menos un artículo';
	return null;
}
