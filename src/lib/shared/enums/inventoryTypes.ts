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

// ============================================================================
// ADJUSTMENT REASON
// ============================================================================

export enum AdjustmentReason {
	/** Corrección tras conteo físico */
	PHYSICAL_COUNT = 'PHYSICAL_COUNT',
	/** Daño / merma */
	DAMAGE = 'DAMAGE',
	/** Muestra o cortesía */
	SAMPLE = 'SAMPLE',
	/**
	 * Devolución física sin reembolso.
	 * BACKLOG: Para devoluciones CON reembolso se necesita el módulo
	 * de Notas de Crédito (credit_notes), que crea un nuevo documento
	 * vinculado a la venta original, revierte ingresos en reportes,
	 * y genera un movimiento RETURN_IN. Fuera de alcance aquí.
	 */
	CUSTOMER_RETURN = 'CUSTOMER_RETURN',
	/** Error al registrar entrada de mercancía */
	ENTRY_ERROR = 'ENTRY_ERROR',
	/** Otro motivo */
	OTHER = 'OTHER'
}

export const ALL_ADJUSTMENT_REASONS = Object.values(AdjustmentReason) as AdjustmentReason[];

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
	[AdjustmentReason.PHYSICAL_COUNT]: 'Conteo físico',
	[AdjustmentReason.DAMAGE]: 'Daño / merma',
	[AdjustmentReason.SAMPLE]: 'Muestra o cortesía',
	[AdjustmentReason.CUSTOMER_RETURN]: 'Devolución de cliente (sin reembolso)',
	[AdjustmentReason.ENTRY_ERROR]: 'Error de registro',
	[AdjustmentReason.OTHER]: 'Otro'
};

export function getAdjustmentReasonLabel(reason: string): string {
	return ADJUSTMENT_REASON_LABELS[reason as AdjustmentReason] ?? reason;
}

/**
 * Maps an adjustment reason to a report category for profit reports.
 * Only DAMAGE and SAMPLE reduce profit (real losses).
 * PHYSICAL_COUNT, ENTRY_ERROR, OTHER are informational (data corrections).
 * CUSTOMER_RETURN is informational (no cost impact - unit comes back).
 */
export const ADJUSTMENT_REPORT_CATEGORIES: Record<AdjustmentReason, string> = {
	[AdjustmentReason.DAMAGE]: 'Pérdidas operativas',
	[AdjustmentReason.SAMPLE]: 'Muestras y cortesías',
	[AdjustmentReason.CUSTOMER_RETURN]: 'Devoluciones recibidas',
	[AdjustmentReason.PHYSICAL_COUNT]: 'Ajustes de inventario',
	[AdjustmentReason.ENTRY_ERROR]: 'Ajustes de inventario',
	[AdjustmentReason.OTHER]: 'Ajustes de inventario'
};

/** Reasons that represent real financial losses (reduce profit) */
export const LOSS_REASONS: AdjustmentReason[] = [AdjustmentReason.DAMAGE, AdjustmentReason.SAMPLE];
