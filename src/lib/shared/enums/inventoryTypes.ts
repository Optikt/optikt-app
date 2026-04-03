/**
 * Inventory movement enums
 * Movement types and reference types for the inventory tracking system
 */

// ============================================================================
// INVENTORY MOVEMENT TYPE
// ============================================================================

export enum InventoryMovementType {
	/** Entrada por compra confirmada */
	PURCHASE_IN = 'PURCHASE_IN',
	/** Salida por venta */
	SALE_OUT = 'SALE_OUT',
	/** Entrada por ajuste manual (corrección positiva, donación recibida) */
	ADJUSTMENT_IN = 'ADJUSTMENT_IN',
	/** Salida por ajuste manual (merma, error, robo, regalo) */
	ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
	/** Entrada por devolución de cliente (futuro) */
	RETURN_IN = 'RETURN_IN',
	/** Reversión por cancelación de venta */
	CANCEL_REVERT = 'CANCEL_REVERT'
}

export const ALL_INVENTORY_MOVEMENT_TYPES = Object.values(
	InventoryMovementType
) as InventoryMovementType[];

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
	[InventoryMovementType.PURCHASE_IN]: 'Entrada por compra',
	[InventoryMovementType.SALE_OUT]: 'Salida por venta',
	[InventoryMovementType.ADJUSTMENT_IN]: 'Ajuste positivo',
	[InventoryMovementType.ADJUSTMENT_OUT]: 'Ajuste negativo',
	[InventoryMovementType.RETURN_IN]: 'Devolución',
	[InventoryMovementType.CANCEL_REVERT]: 'Reversión por cancelación'
};

export function getInventoryMovementTypeLabel(type: string): string {
	return INVENTORY_MOVEMENT_TYPE_LABELS[type as InventoryMovementType] ?? type;
}

// ============================================================================
// MOVEMENT REFERENCE TYPE
// ============================================================================

export enum MovementReferenceType {
	/** Referencia a una purchase_order */
	PURCHASE_ORDER = 'PURCHASE_ORDER',
	/** Referencia a una sale */
	SALE = 'SALE',
	/** Ajuste manual sin documento padre */
	MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT'
}

export const ALL_MOVEMENT_REFERENCE_TYPES = Object.values(
	MovementReferenceType
) as MovementReferenceType[];

export const MOVEMENT_REFERENCE_TYPE_LABELS: Record<MovementReferenceType, string> = {
	[MovementReferenceType.PURCHASE_ORDER]: 'Orden de compra',
	[MovementReferenceType.SALE]: 'Venta',
	[MovementReferenceType.MANUAL_ADJUSTMENT]: 'Ajuste manual'
};

export function getMovementReferenceTypeLabel(type: string): string {
	return MOVEMENT_REFERENCE_TYPE_LABELS[type as MovementReferenceType] ?? type;
}
