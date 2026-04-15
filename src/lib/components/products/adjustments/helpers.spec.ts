import { describe, expect, it } from 'vitest';

import {
	buildAdjustmentSteps,
	getAllowedAdjustmentTypes,
	getDefaultAdjustmentType,
	getNotesRemaining,
	getProjectedLotQuantity
} from './helpers';
import { AdjustmentReason, InventoryMovementType } from '$lib/shared/enums';

describe('product adjustment helpers', () => {
	it('builds the initial step state before a lot is selected', () => {
		expect(
			buildAdjustmentSteps({
				hasLot: false,
				hasDetails: false,
				isReady: false
			})
		).toEqual([
			{
				id: 1,
				title: 'Seleccion',
				description: 'Elegir lote disponible',
				status: 'current'
			},
			{
				id: 2,
				title: 'Detalles',
				description: 'Motivo y cantidad',
				status: 'upcoming'
			},
			{
				id: 3,
				title: 'Impacto',
				description: 'Costo y trazabilidad',
				status: 'upcoming'
			},
			{
				id: 4,
				title: 'Confirmar',
				description: 'Registrar movimiento',
				status: 'upcoming'
			}
		]);
	});

	it('marks selection and detail steps as complete once data exists', () => {
		expect(
			buildAdjustmentSteps({
				hasLot: true,
				hasDetails: true,
				isReady: false
			})
		).toEqual([
			{
				id: 1,
				title: 'Seleccion',
				description: 'Elegir lote disponible',
				status: 'complete'
			},
			{
				id: 2,
				title: 'Detalles',
				description: 'Motivo y cantidad',
				status: 'complete'
			},
			{
				id: 3,
				title: 'Impacto',
				description: 'Costo y trazabilidad',
				status: 'current'
			},
			{
				id: 4,
				title: 'Confirmar',
				description: 'Registrar movimiento',
				status: 'upcoming'
			}
		]);
	});

	it('moves confirmation to current when the form is ready', () => {
		expect(
			buildAdjustmentSteps({
				hasLot: true,
				hasDetails: true,
				isReady: true
			})
		).toEqual([
			{
				id: 1,
				title: 'Seleccion',
				description: 'Elegir lote disponible',
				status: 'complete'
			},
			{
				id: 2,
				title: 'Detalles',
				description: 'Motivo y cantidad',
				status: 'complete'
			},
			{
				id: 3,
				title: 'Impacto',
				description: 'Costo y trazabilidad',
				status: 'complete'
			},
			{
				id: 4,
				title: 'Confirmar',
				description: 'Registrar movimiento',
				status: 'current'
			}
		]);
	});

	it('projects the next lot quantity for outflows', () => {
		expect(getProjectedLotQuantity(18, 4, true)).toBe(14);
	});

	it('projects the next lot quantity for inflows', () => {
		expect(getProjectedLotQuantity(18, 4, false)).toBe(22);
	});

	it('calculates how many note characters are still required', () => {
		expect(getNotesRemaining('conteo')).toBe(4);
		expect(getNotesRemaining('conteo fisico listo')).toBe(0);
	});

	it('only allows outflow for damage', () => {
		expect(getAllowedAdjustmentTypes(AdjustmentReason.DAMAGE)).toEqual([
			InventoryMovementType.ADJUSTMENT_OUT
		]);
		expect(getDefaultAdjustmentType(AdjustmentReason.DAMAGE)).toBe(
			InventoryMovementType.ADJUSTMENT_OUT
		);
	});

	it('only allows inflow for customer returns', () => {
		expect(getAllowedAdjustmentTypes(AdjustmentReason.CUSTOMER_RETURN)).toEqual([
			InventoryMovementType.ADJUSTMENT_IN
		]);
		expect(getDefaultAdjustmentType(AdjustmentReason.CUSTOMER_RETURN)).toBe(
			InventoryMovementType.ADJUSTMENT_IN
		);
	});

	it('requires explicit choice when a reason supports both directions', () => {
		expect(getAllowedAdjustmentTypes(AdjustmentReason.PHYSICAL_COUNT)).toEqual([
			InventoryMovementType.ADJUSTMENT_IN,
			InventoryMovementType.ADJUSTMENT_OUT
		]);
		expect(getDefaultAdjustmentType(AdjustmentReason.PHYSICAL_COUNT)).toBeNull();
	});
});
