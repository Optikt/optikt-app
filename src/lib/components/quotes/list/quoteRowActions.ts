/**
 * Acciones del menú ⋯ de un presupuesto en el listado.
 *
 * Única fuente del gating: la consumen el DropdownMenu de escritorio
 * (`QuoteRowMenu`) y la hoja inferior móvil (`QuoteRowActionsSheet`) — mismas
 * reglas, dos presentaciones (mismo patrón que `saleRowActions`).
 *
 * Reglas (D7 + dominio quotes):
 * - Ver detalle: siempre.
 * - Editar / Convertir / Cancelar: gestionable + DRAFT.
 * - Duplicar: gestionable, desde cualquier estado.
 */
import { ArrowRightLeft, CircleX, Copy, Eye, Pen } from '@lucide/svelte';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

export type QuoteRowActionId = 'detail' | 'edit' | 'convert' | 'duplicate' | 'cancel';

export interface QuoteRowAction {
	id: QuoteRowActionId;
	label: string;
	/** Subtítulo (hoja móvil y popover). */
	description?: string;
	/** Destructiva: fila roja + separador. */
	danger?: boolean;
}

/** Icono lucide de cada acción — única fuente para popover y hoja móvil. */
export const QUOTE_ROW_ACTION_ICONS = {
	detail: Eye,
	edit: Pen,
	convert: ArrowRightLeft,
	duplicate: Copy,
	cancel: CircleX
} as const;

export function quoteRowActions(quote: { status: string }, canManage: boolean): QuoteRowAction[] {
	const isDraft = quote.status === QuoteStatus.DRAFT;
	const actions: QuoteRowAction[] = [{ id: 'detail', label: 'Ver detalle' }];
	if (canManage && isDraft) {
		actions.push({ id: 'edit', label: 'Editar' });
		actions.push({ id: 'convert', label: 'Convertir a venta' });
	}
	if (canManage) {
		actions.push({
			id: 'duplicate',
			label: 'Duplicar',
			description: 'Nuevo presupuesto con los mismos ítems'
		});
	}
	if (canManage && isDraft) {
		actions.push({ id: 'cancel', label: 'Cancelar presupuesto', danger: true });
	}
	return actions;
}
