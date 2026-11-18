/**
 * Validez derivada del presupuesto (D3): "vencido" se CALCULA al leer, nunca
 * se escribe `status = EXPIRED` (el valor del enum queda sin uso, documentado
 * en docs/agents/quotes.md). `validUntil: null` = sin vencimiento.
 *
 * Pura y testeada; la consumen la lista y el detalle. Fechas en zona horaria
 * del negocio (America/Caracas), nunca UTC crudo.
 */

import { QuoteStatus } from '$lib/shared/contracts/quotes';

export type QuoteValidityKind = 'none' | 'ok' | 'soon' | 'expired' | 'na';

export interface QuoteValidity {
	kind: QuoteValidityKind;
	/** Días restantes (negativo = vencido). Ausente para `none`/`na`. */
	daysLeft?: number;
	/** Fecha de vencimiento "YYYY-MM-DD" (business tz). */
	validUntilDate?: string;
}

const CARACAS_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' });

/** Hoy como "YYYY-MM-DD" en la zona horaria del negocio. */
export function businessTodayISO(now: Date = new Date()): string {
	return CARACAS_DATE_FMT.format(now);
}

/** Fecha "YYYY-MM-DD" (business tz) de un timestamp ISO de la DB. */
function businessDateOf(iso: string): string {
	return CARACAS_DATE_FMT.format(new Date(iso));
}

function daysBetween(fromISO: string, toISO: string): number {
	const a = Date.UTC(
		Number(fromISO.slice(0, 4)),
		Number(fromISO.slice(5, 7)) - 1,
		Number(fromISO.slice(8, 10))
	);
	const b = Date.UTC(
		Number(toISO.slice(0, 4)),
		Number(toISO.slice(5, 7)) - 1,
		Number(toISO.slice(8, 10))
	);
	return Math.round((b - a) / 86_400_000);
}

/**
 * Validez de un presupuesto. `soon` cuando quedan ≤3 días; `na` para estados
 * terminales (CONVERTED/CANCELLED no muestran validez).
 */
export function quoteValidity(
	validUntil: string | null,
	status: QuoteStatus,
	todayISO: string
): QuoteValidity {
	if (status !== QuoteStatus.DRAFT) {
		return { kind: 'na' };
	}
	if (!validUntil) {
		return { kind: 'none' };
	}

	const validUntilDate = businessDateOf(validUntil);
	const daysLeft = daysBetween(todayISO, validUntilDate);

	if (daysLeft < 0) {
		return { kind: 'expired', daysLeft, validUntilDate };
	}
	if (daysLeft <= 3) {
		return { kind: 'soon', daysLeft, validUntilDate };
	}
	return { kind: 'ok', daysLeft, validUntilDate };
}

/** "29/11" desde "YYYY-MM-DD" (formato corto del mockup). */
export function shortDateLabel(dateISO: string): string {
	return `${dateISO.slice(8, 10)}/${dateISO.slice(5, 7)}`;
}

/** Texto de la columna "Validez" del listado. */
export function quoteValidityListText(validity: QuoteValidity): string | null {
	switch (validity.kind) {
		case 'none':
			return 'Sin vencimiento';
		case 'ok': {
			const days = validity.daysLeft ?? 0;
			return `${shortDateLabel(validity.validUntilDate!)} · en ${days} d`;
		}
		case 'soon': {
			const days = validity.daysLeft ?? 0;
			if (days === 0) return 'Vence hoy';
			if (days === 1) return 'Vence mañana';
			return `Vence en ${days} d`;
		}
		case 'expired':
			return `Vencido ${shortDateLabel(validity.validUntilDate!)}`;
		default:
			return null;
	}
}

/** Texto secundario del detalle ("vence en 11 días"). */
export function quoteValidityDetailText(validity: QuoteValidity): string | null {
	switch (validity.kind) {
		case 'none':
			return 'Sin vencimiento';
		case 'soon': {
			const days = validity.daysLeft ?? 0;
			if (days === 0) return 'vence hoy';
			if (days === 1) return 'vence mañana';
			return `vence en ${days} días`;
		}
		case 'ok': {
			const days = validity.daysLeft ?? 0;
			return `vence en ${days} días`;
		}
		case 'expired':
			return `vencido el ${shortDateLabel(validity.validUntilDate!)}`;
		default:
			return null;
	}
}
