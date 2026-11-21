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
import type { ItemGroup } from '$lib/shared/saleItemGroups';

/** Per-person grouping changes from the Personas tab (only what changed is sent). */
export interface GroupsPatch {
	groups?: ItemGroup[];
	/** Sales only. */
	primaryLensItemId?: string | null;
}

export interface SubmitQuoteEditInput {
	mode: 'quote';
	quote: QuoteWithRelations;
	draft: QuoteEditDraft;
	groupsPatch?: GroupsPatch;
}

export interface SubmitSaleEditInput {
	mode: 'sale';
	sale: SaleWithRelations;
	originalItems: SaleItemWithDetails[];
	draft: UpdateSaleDraft;
	groupsPatch?: GroupsPatch;
}

/** Devuelve `null` si guardó, o el mensaje de error ya notificado con toast. */
export async function submitEditSale(
	input: SubmitQuoteEditInput | SubmitSaleEditInput
): Promise<string | null> {
	if (input.mode === 'quote') {
		try {
			const payload = buildQuoteUpdatePayload(input.quote, input.draft);
			if (input.groupsPatch?.groups) payload.groups = input.groupsPatch.groups;
			const result = await updateExistingQuote(payload);
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
		if (input.groupsPatch?.groups) payload.groups = input.groupsPatch.groups;
		if (input.groupsPatch?.primaryLensItemId !== undefined) {
			payload.primaryLensItemId = input.groupsPatch.primaryLensItemId;
		}
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

/** Inputs of the drawer the submit needs (keeps the modal under the size gate). */
export interface EditSubmitState {
	quote?: QuoteWithRelations;
	sale?: SaleWithRelations;
	items: SaleItemWithDetails[];
	editableItems: QuoteEditDraft['items'];
	activeItems: UpdateSaleDraft['activeItems'];
	removedCount: number;
	saleDate: string;
	validUntil: string;
	notes: string;
	isCashea: boolean;
	discount: number;
	discountType: string;
	reason: string;
	prescription: { dp: number | null; npRight: number | null; npLeft: number | null } | null;
	measures: { odDp: number | null; odDnp: number | null; osDnp: number | null };
	groupsPatch: GroupsPatch;
}

export function buildEditSubmitInput(
	st: EditSubmitState
): SubmitQuoteEditInput | SubmitSaleEditInput {
	if (st.quote) {
		return {
			mode: 'quote',
			quote: st.quote,
			groupsPatch: st.groupsPatch,
			draft: {
				dateIso: st.saleDate,
				validUntilIso: st.validUntil,
				notes: st.notes,
				isCashea: st.isCashea,
				discount: st.discount,
				discountType: st.discountType,
				items: st.editableItems
			}
		};
	}
	return {
		mode: 'sale',
		sale: st.sale!,
		groupsPatch: st.groupsPatch,
		originalItems: st.items,
		draft: {
			saleDate: st.saleDate,
			notes: st.notes,
			isCashea: st.isCashea,
			discount: st.discount,
			discountType: st.discountType,
			reason: st.reason,
			removedCount: st.removedCount,
			activeItems: st.activeItems,
			originalItems: st.items,
			prescription: {
				dp: st.prescription?.dp ?? null,
				npRight: st.prescription?.npRight ?? null,
				npLeft: st.prescription?.npLeft ?? null
			},
			prescriptionPatch: {
				dp: st.measures.odDp,
				npRight: st.measures.odDnp,
				npLeft: st.measures.osDnp
			}
		}
	};
}
