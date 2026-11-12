import { describe, expect, it } from 'vitest';
import { SaleStatus } from '$lib/shared/enums';
import { formatOrderNumber, relativeDaysLabel, saleListStatusLabel } from './saleDisplay';

const NOW = new Date(2026, 10, 10, 23, 30); // 10/11/2026

describe('relativeDaysLabel', () => {
	it('dice hoy para el mismo día', () => {
		expect(relativeDaysLabel('2026-11-10T08:00:00.000Z', NOW)).toBe('hoy');
	});

	it('dice ayer para el día anterior', () => {
		expect(relativeDaysLabel('2026-11-09T22:00:00.000Z', NOW)).toBe('ayer');
	});

	it('cuenta días completos hacia atrás', () => {
		expect(relativeDaysLabel('2026-11-03T10:00:00.000Z', NOW)).toBe('hace 7 d');
	});

	it('no se salta a "ayer" por diferencia de horas (usa el día local)', () => {
		// 09/11 a las 23:59 sigue siendo "ayer" respecto al 10/11
		expect(relativeDaysLabel('2026-11-09T23:59:00.000Z', NOW)).toBe('ayer');
	});

	it('devuelve string vacío con fechas inválidas', () => {
		expect(relativeDaysLabel('no-es-fecha', NOW)).toBe('');
	});
});

describe('formatOrderNumber', () => {
	it('prefija el número de orden', () => {
		expect(formatOrderNumber(265)).toBe('#265');
		expect(formatOrderNumber(1)).toBe('#1');
	});
});

describe('saleListStatusLabel', () => {
	it('acorta READY a DISPONIBLE (solo en la tabla)', () => {
		expect(saleListStatusLabel(SaleStatus.READY)).toBe('DISPONIBLE');
	});

	it('mantiene el resto de etiquetas canónicas', () => {
		expect(saleListStatusLabel(SaleStatus.PENDING)).toBe('Pendiente');
		expect(saleListStatusLabel(SaleStatus.IN_PROGRESS)).toBe('En Progreso');
		expect(saleListStatusLabel(SaleStatus.COMPLETED)).toBe('Completada');
		expect(saleListStatusLabel(SaleStatus.CANCELLED)).toBe('Cancelada');
	});

	it('devuelve el valor crudo ante estados desconocidos', () => {
		expect(saleListStatusLabel('DESCONOCIDO')).toBe('DESCONOCIDO');
	});
});
