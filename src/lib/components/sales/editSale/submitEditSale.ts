/**
 * Persistencia del drawer de edición (venta o presupuesto).
 * Extraído de `EditSaleModal.svelte` para mantener el componente bajo el gate
 * de tamaño; la lógica de validación y armado de payload sigue en
 * `editSaleDraft` / `quoteEditAdapter` (fuente única).
 */
import { toast } from 'svelte-sonner';
import { updateSale } from '$lib/remote/sales/update.remote';
import { updateExistingQuote } from '$lib/remote/quotes/commands.remote';
import { getErrorMessage, logger } from '$lib/utils';
import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';
import {
	buildQuoteUpdatePayload,
	type QuoteEditDraft
} from '$lib/components/quotes/editQuote/quoteEditAdapter';
import { buildUpdateSalePayload, type UpdateSaleDraft } from '../editSaleDraft';

export interface SubmitQuoteEditInput {
	mode: 'quote';
	quote: QuoteWithRelations;
	draft: QuoteEditDraft;
}

export interface SubmitSaleEditInput {
	mode: 'sale';
	sale: SaleWithRelations;
	originalItems: SaleItemWithDetails[];
	draft: UpdateSaleDraft;
}

/** Devuelve `null` si guardó, o el mensaje de error ya notificado con toast. */
export async function submitEditSale(
	input: SubmitQuoteEditInput | SubmitSaleEditInput
): Promise<string | null> {
	if (input.mode === 'quote') {
		try {
			const result = await updateExistingQuote(buildQuoteUpdatePayload(input.quote, input.draft));
			if (result.success) {
				toast.success('Presupuesto actualizado');
				return null;
			}
			const error = result.error ?? 'Error actualizando presupuesto';
			toast.error(error);
			return error;
		} catch (e) {
			logger.error('Error actualizando presupuesto', e);
			const error = getErrorMessage(e, 'Error actualizando presupuesto');
			toast.error(error);
			return error;
		}
	}

	try {
		const payload = buildUpdateSalePayload(input.sale, input.draft);
		const result = await updateSale(payload);
		if (result.success) {
			toast.success('Venta actualizada');
			return null;
		}
		const error = result.error ?? 'Error actualizando venta';
		toast.error(error);
		return error;
	} catch (e) {
		logger.error('Error actualizando venta', e);
		const error = getErrorMessage(e, 'Error actualizando venta');
		toast.error(error);
		return error;
	}
}
