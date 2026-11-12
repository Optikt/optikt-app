/** Helpers de presentación del listado de ventas (lista + cuadros). */
import { SALE_STATUS_LABELS, SaleStatus } from '$lib/shared/enums';

/**
 * Etiqueta de antigüedad de una fecha, estilo mockup: "hoy" / "ayer" / "hace N d".
 * Usa el día local de `now` (ignora horas) para que no salte "hace 1 d" a mitad de la noche.
 */
export function relativeDaysLabel(isoDate: string, now: Date = new Date()): string {
	const then = new Date(isoDate);
	if (Number.isNaN(then.getTime())) return '';

	const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
	const days = Math.round((startOfNow.getTime() - startOfThen.getTime()) / 86_400_000);

	if (days <= 0) return 'hoy';
	if (days === 1) return 'ayer';
	return `hace ${days} d`;
}

/** `#265` — número de orden formateado para mostrar. */
export function formatOrderNumber(orderNumber: number): string {
	return `#${orderNumber}`;
}

/**
 * Etiqueta de estado para la TABLA del listado de ventas.
 * `READY` se muestra como "DISPONIBLE": es más corto, la pill cabe en su columna
 * y la fila no salta de alto. Solo aplica a la lista (el detalle y las pestañas
 * de filtro conservan la etiqueta canónica de `SALE_STATUS_LABELS`).
 */
export function saleListStatusLabel(status: string): string {
	if (status === SaleStatus.READY) return 'DISPONIBLE';
	return SALE_STATUS_LABELS[status as SaleStatus] ?? status;
}
