/**
 * Presentación del listado de presupuestos (lista + tarjetas móviles).
 * Reutiliza helpers de ventas (relativeDaysLabel, clases) — este archivo solo
 * agrega lo específico de quotes.
 */
import type { QuoteValidity } from '$lib/shared/quotes/quoteValidity';

/** `P-0248` — número de presupuesto con padding a 4. */
export function formatQuoteNumber(quoteNumber: number): string {
	return `P-${String(quoteNumber).padStart(4, '0')}`;
}

/** `#0298` — número de la venta generada, mismo estilo del detalle. */
export function formatConvertedSaleRef(orderNumber: number): string {
	return `#${String(orderNumber).padStart(4, '0')}`;
}

/** Clases de la celda de validez: texto plano, chip ámbar (soon) o chip rojo (expired). */
export function validityClasses(kind: QuoteValidity['kind']): string {
	switch (kind) {
		case 'soon':
			return 'inline-flex items-center gap-1 rounded bg-warning-container px-1.5 py-0.5 text-[12px] font-semibold text-on-warning-container';
		case 'expired':
			return 'inline-flex items-center gap-1 rounded bg-error-container px-1.5 py-0.5 text-[12px] font-semibold text-on-error-container';
		case 'none':
			return 'text-[13px] text-outline';
		default:
			return 'text-[13px] text-on-surface tabular-nums';
	}
}
