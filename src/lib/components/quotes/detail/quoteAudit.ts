/**
 * Clasificación de eventos de auditoría del presupuesto (timeline del detalle).
 *
 * Produce el MISMO `AuditEvent` que ventas para reusar su UI
 * (`SaleAuditEvent`: artículos / datos / totales con antes → después). Eventos:
 * creado (+ duplicado de / sin cliente), editado (diff `itemsDiff` que anexa
 * `updateExistingQuoteCore`), convertido (+ venta) y cancelado (+ motivo).
 */

import { isGroupsOnlyChange } from '$lib/utils/saleDetail';
import { countSaleAuditChanges } from '$lib/schemas/sales';
import type { ChangeRecord as HistoryChangeRecord } from '$lib/components/history/display-utils';
import {
	buildAuditEvent,
	extractSaleAuditDiff,
	saleAuditTotalDelta,
	type AuditEvent,
	type ClassifiableAuditEntry
} from '$lib/utils/saleDetail';

export type QuoteAuditEntry = Omit<ClassifiableAuditEntry, 'entityType'> & {
	entityType?: string;
};

export interface QuoteAuditContext {
	/** Número del presupuesto origen si es duplicado ("Duplicado de P-0231"). */
	sourceQuoteNumber?: number | null;
	/** Número de la venta generada ("Convertido en venta #0298"). */
	convertedOrderNumber?: number | null;
	/** El presupuesto lleva Cashea ("Cashea activado" en el evento de conversión). */
	quoteIsCashea: boolean;
	/** El presupuesto se creó sin cliente (nota del evento de creación). */
	createdWithoutCustomer: boolean;
}

type FieldMap = Record<string, { old?: unknown; new?: unknown } | undefined>;

function pad4(n: number): string {
	return String(n).padStart(4, '0');
}

/**
 * Resumen corto de una edición SIN diff estructurado (eventos anteriores al
 * `itemsDiff`): campos tocados + Cashea explícito.
 */
export function quoteEditSummary(changes: FieldMap | null): string | null {
	if (!changes) return null;
	const parts: string[] = [];

	const cashea = changes.isCashea;
	if (cashea && cashea.new === true && cashea.old !== true) parts.push('Cashea activado');
	else if (cashea && cashea.new !== true && cashea.old === true) parts.push('Cashea quitado');

	if (changes.customerId) parts.push('Cliente');
	if (changes.discount || changes.discountType) parts.push('Descuento');
	if (changes.validUntil) parts.push('Validez');
	if (changes.notes) parts.push('Nota');
	if (changes.items || changes.subtotal || changes.total) parts.push('Ítems');

	return parts.length > 0 ? parts.join(' · ') : null;
}

export function classifyQuoteAuditEntry(
	raw: QuoteAuditEntry,
	ctx: QuoteAuditContext
): AuditEvent | null {
	const entry: ClassifiableAuditEntry = { ...raw, entityType: 'quote' };
	const fields = (entry.changes ?? {}) as FieldMap;
	const record = entry.changes as unknown as HistoryChangeRecord | null;
	const hasChanges = Object.keys(fields).length > 0;

	if (entry.action === 'create') {
		return buildAuditEvent(entry, {
			label: 'Presupuesto creado',
			kind: 'create',
			note: ctx.sourceQuoteNumber
				? `Duplicado de P-${pad4(ctx.sourceQuoteNumber)}`
				: ctx.createdWithoutCustomer
					? 'Sin cliente'
					: null
		});
	}

	if (entry.action !== 'update') return null;

	const status = fields.status;

	if (status?.new === 'CONVERTED') {
		return buildAuditEvent(entry, {
			label: ctx.convertedOrderNumber
				? `Convertido en venta #${pad4(ctx.convertedOrderNumber)}`
				: 'Convertido en venta',
			kind: 'status',
			note: ctx.quoteIsCashea ? 'Cashea activado' : null
		});
	}

	if (status?.new === 'CANCELLED') {
		const reason =
			entry.reason ??
			(typeof fields.cancellationReason?.new === 'string' ? fields.cancellationReason.new : null);
		return buildAuditEvent(entry, {
			label: 'Presupuesto cancelado',
			kind: 'cancel',
			reason: reason || null
		});
	}

	// Edición normal (sin cambio de estado): diff estructurado como ventas.
	const itemsDiff = extractSaleAuditDiff(entry.changes);
	return buildAuditEvent(entry, {
		label: fields.customerId
			? 'Cliente actualizado'
			: isGroupsOnlyChange(fields)
				? 'Agrupación por persona actualizada'
				: 'Presupuesto editado',
		kind: 'update',
		changes: hasChanges ? record : null,
		reason: entry.reason || null,
		itemsDiff,
		totalDelta: saleAuditTotalDelta(itemsDiff),
		changeCount: itemsDiff ? countSaleAuditChanges(itemsDiff) : 0,
		// Eventos viejos sin diff: resumen corto + filas campo a campo al expandir.
		note: itemsDiff
			? null
			: isGroupsOnlyChange(fields)
				? String(fields.personGroups?.new ?? '')
				: quoteEditSummary(fields)
	});
}
