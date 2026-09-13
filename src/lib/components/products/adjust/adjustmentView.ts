import {
	ADJUSTMENT_REASON_LABELS,
	ALL_ADJUSTMENT_REASONS,
	InventoryMovementType,
	type AdjustmentReason
} from '$lib/shared/enums';
import type { ManualAdjustmentType } from '$lib/components/products/adjustments/helpers';

export interface ReasonOption {
	value: AdjustmentReason;
	label: string;
}

export function buildReasonOptions(): ReasonOption[] {
	return ALL_ADJUSTMENT_REASONS.map((value) => ({
		value,
		label: ADJUSTMENT_REASON_LABELS[value]
	}));
}

export function getDirectionHint(
	detailsEnabled: boolean,
	selectedReason: AdjustmentReason | null,
	allowedCount: number,
	adjustmentType: ManualAdjustmentType | null
): string {
	if (!detailsEnabled) {
		return 'Selecciona un lote para continuar.';
	}

	if (selectedReason == null) {
		return 'Selecciona un motivo para habilitar direcciones validas.';
	}

	if (allowedCount === 1) {
		return adjustmentType === InventoryMovementType.ADJUSTMENT_IN
			? 'Este motivo solo admite incremento.'
			: 'Este motivo solo admite reduccion.';
	}

	return 'Selecciona la direccion del ajuste segun el caso.';
}

export function getQuantityError(
	parsedQuantity: number,
	isOutflow: boolean,
	available: number | null
): string | null {
	if (parsedQuantity <= 0) return null;
	if (isOutflow && available != null && parsedQuantity > available) {
		return `Maximo disponible: ${available}`;
	}
	return null;
}

export function findLastManualAdjustment<T extends { referenceType: string }>(
	movements: T[],
	manualReferenceType: string
): T | null {
	return movements.find((movement) => movement.referenceType === manualReferenceType) ?? null;
}
