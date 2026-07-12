import { AdjustmentReason, InventoryMovementType } from '$lib/shared/enums';

export type AdjustmentStepStatus = 'current' | 'complete' | 'upcoming';

export type ManualAdjustmentType =
	InventoryMovementType.ADJUSTMENT_IN | InventoryMovementType.ADJUSTMENT_OUT;

export interface AdjustmentStep {
	id: number;
	title: string;
	description: string;
	status: AdjustmentStepStatus;
}

interface AdjustmentStepInput {
	hasLot: boolean;
	hasDetails: boolean;
	isReady: boolean;
}

export function buildAdjustmentSteps({
	hasLot,
	hasDetails,
	isReady
}: AdjustmentStepInput): AdjustmentStep[] {
	return [
		{
			id: 1,
			title: 'Seleccion',
			description: 'Elegir lote disponible',
			status: hasLot ? 'complete' : 'current'
		},
		{
			id: 2,
			title: 'Detalles',
			description: 'Motivo y cantidad',
			status: !hasLot ? 'upcoming' : hasDetails ? 'complete' : 'current'
		},
		{
			id: 3,
			title: 'Impacto',
			description: 'Costo y trazabilidad',
			status: !hasDetails ? 'upcoming' : isReady ? 'complete' : 'current'
		},
		{
			id: 4,
			title: 'Confirmar',
			description: 'Registrar movimiento',
			status: isReady ? 'current' : 'upcoming'
		}
	];
}

export function getProjectedLotQuantity(
	quantityAvailable: number,
	quantity: number,
	isOutflow: boolean
): number {
	return quantityAvailable + (isOutflow ? -quantity : quantity);
}

export function getNotesRemaining(notes: string, minLength = 10): number {
	return Math.max(0, minLength - notes.length);
}

export function getAllowedAdjustmentTypes(
	reason: AdjustmentReason | '' | null | undefined
): ManualAdjustmentType[] {
	if (!reason) return [];

	switch (reason) {
		case AdjustmentReason.DAMAGE:
			return [InventoryMovementType.ADJUSTMENT_OUT];
		case AdjustmentReason.CUSTOMER_RETURN:
			return [InventoryMovementType.ADJUSTMENT_IN];
		case AdjustmentReason.PHYSICAL_COUNT:
		case AdjustmentReason.SAMPLE:
		case AdjustmentReason.ENTRY_ERROR:
		case AdjustmentReason.OTHER:
			return [InventoryMovementType.ADJUSTMENT_IN, InventoryMovementType.ADJUSTMENT_OUT];
	}
}

export function getDefaultAdjustmentType(
	reason: AdjustmentReason | '' | null | undefined
): ManualAdjustmentType | null {
	const allowedTypes = getAllowedAdjustmentTypes(reason);
	return allowedTypes.length === 1 ? allowedTypes[0] : null;
}
