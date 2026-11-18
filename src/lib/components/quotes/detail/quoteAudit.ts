/**
 * Clasificación de eventos de auditoría del presupuesto (timeline del detalle).
 * Los eventos de `change_history` con entityType 'quote' se convierten en
 * eventos legibles: creado (+ duplicado de), editado (resumen del diff),
 * convertido (+ venta) y cancelado (+ motivo).
 */

export interface QuoteAuditEntry {
	id: string;
	action: string;
	changes: Record<string, { old?: unknown; new?: unknown } | undefined> | null;
	changedAt: string;
	changedByName: string | null;
	reason?: string | null;
}

export type QuoteAuditTone = 'navy' | 'blue' | 'success' | 'error';
export type QuoteAuditIcon = 'plus' | 'pen' | 'convert' | 'cancel';

export interface QuoteAuditEvent {
	id: string;
	title: string;
	detail: string | null;
	changedAt: string;
	changedByName: string | null;
	tone: QuoteAuditTone;
	icon: QuoteAuditIcon;
}

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

function readField(
	changes: QuoteAuditEntry['changes'],
	key: string
): { old?: unknown; new?: unknown } | undefined {
	return changes?.[key];
}

/** Resumen del diff de edición: campos tocados + Cashea explícito. */
export function quoteEditSummary(changes: QuoteAuditEntry['changes']): string | null {
	if (!changes) return null;
	const parts: string[] = [];

	const cashea = readField(changes, 'isCashea');
	if (cashea && cashea.new === true && cashea.old !== true) parts.push('Cashea activado');
	else if (cashea && cashea.new !== true && cashea.old === true) parts.push('Cashea quitado');

	if (readField(changes, 'customerId')) parts.push('Cliente');
	if (readField(changes, 'discount') || readField(changes, 'discountType')) {
		parts.push('Descuento');
	}
	if (readField(changes, 'validUntil')) parts.push('Validez');
	if (readField(changes, 'notes')) parts.push('Nota');
	if (
		readField(changes, 'items') ||
		readField(changes, 'subtotal') ||
		readField(changes, 'total')
	) {
		parts.push('Ítems');
	}

	return parts.length > 0 ? parts.join(' · ') : null;
}

export function classifyQuoteAuditEntry(
	entry: QuoteAuditEntry,
	ctx: QuoteAuditContext
): QuoteAuditEvent | null {
	if (entry.action === 'create') {
		return {
			id: entry.id,
			title: 'Presupuesto creado',
			detail: ctx.sourceQuoteNumber
				? `Duplicado de P-${String(ctx.sourceQuoteNumber).padStart(4, '0')}`
				: ctx.createdWithoutCustomer
					? 'Sin cliente'
					: null,
			changedAt: entry.changedAt,
			changedByName: entry.changedByName,
			tone: 'navy',
			icon: 'plus'
		};
	}

	if (entry.action !== 'update') return null;

	const status = readField(entry.changes, 'status');

	if (status?.new === 'CONVERTED') {
		return {
			id: entry.id,
			title: ctx.convertedOrderNumber
				? `Convertido en venta #${String(ctx.convertedOrderNumber).padStart(4, '0')}`
				: 'Convertido en venta',
			detail: ctx.quoteIsCashea ? 'Cashea activado' : null,
			changedAt: entry.changedAt,
			changedByName: entry.changedByName,
			tone: 'success',
			icon: 'convert'
		};
	}

	if (status?.new === 'CANCELLED') {
		return {
			id: entry.id,
			title: 'Presupuesto cancelado',
			detail:
				(entry.reason ?? (readField(entry.changes, 'cancellationReason')?.new as string)) || null,
			changedAt: entry.changedAt,
			changedByName: entry.changedByName,
			tone: 'error',
			icon: 'cancel'
		};
	}

	// Edición normal (sin cambio de estado)
	const summary = quoteEditSummary(entry.changes);
	return {
		id: entry.id,
		title: 'Presupuesto editado',
		detail: summary,
		changedAt: entry.changedAt,
		changedByName: entry.changedByName,
		tone: 'blue',
		icon: 'pen'
	};
}

/** Filtro del drawer: Todos / Ediciones / Estados. */
export type QuoteAuditFilter = 'all' | 'edits' | 'states';

export function matchesQuoteAuditFilter(event: QuoteAuditEvent, filter: QuoteAuditFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'edits') return event.icon === 'pen';
	return event.icon === 'convert' || event.icon === 'cancel';
}
