/**
 * Supplier type enum
 * Defines the types of suppliers in the optical business
 */

import type { ProductType, ProductTypeColor, typeColors } from './productTypes';

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

/** Get the display label for a supplier type, with fallback to the raw value */
export function getSupplierTypeLabel(type: string): string {
	return SUPPLIER_TYPE_LABELS[type as SupplierType] ?? type;
}

export const supplierTypeColors: Record<SupplierType, 'blue' | 'green' | 'purple'> = {
	[SupplierType.DISTRIBUTOR]: 'blue',
	[SupplierType.LABORATORY]: 'green',
	[SupplierType.BOTH]: 'purple'
};

export type SupplierTypeColor = (typeof supplierTypeColors)[SupplierType];

export function getSupplierBadgeColor(type: string): SupplierTypeColor {
	return supplierTypeColors[type as SupplierType] ?? 'blue';
}
