/**
 * Supplier type enum
 * Defines the types of suppliers in the optical business
 */

export enum SupplierType {
	/** Distribuidor de productos terminados (monturas, lentes terminados, accesorios) */
	DISTRIBUTOR = 'DISTRIBUTOR',
	/** Laboratorio de cristales personalizados */
	LABORATORY = 'LABORATORY',
	/** Hace ambas funciones */
	BOTH = 'BOTH'
}

export const ALL_SUPPLIER_TYPES = Object.values(SupplierType) as SupplierType[];

/** Labels for display in Spanish */
export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
	[SupplierType.DISTRIBUTOR]: 'Distribuidor',
	[SupplierType.LABORATORY]: 'Laboratorio',
	[SupplierType.BOTH]: 'Ambos'
};
