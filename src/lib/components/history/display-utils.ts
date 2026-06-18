/**
 * Audit Display Utilities
 * Client-safe utilities for displaying change history data.
 * These functions can be safely imported into Svelte components.
 */

import type { EntityType, ActionType, ChangeRecord } from '$lib/server/db/schema';
import { fromISO, fromISODate } from '$lib/dates';
import { formatDate } from '$lib/utils';

// Re-export types for convenience (they are just types so it's okay)
export type { EntityType, ActionType, ChangeRecord };

// ============================================================================
// FIELD LABELS
// ============================================================================

/**
 * Human-readable labels for entity fields.
 * Used in the UI to display what changed in a user-friendly way.
 */
export const fieldLabels: Record<EntityType, Record<string, string>> = {
	product: {
		sku: 'SKU',
		name: 'Nombre',
		type: 'Tipo',
		brandId: 'Marca',
		supplierId: 'Proveedor',
		materialId: 'Material',
		color: 'Color',
		size: 'Talla',
		description: 'Descripción',
		purchasePrice: 'Precio de compra',
		salePrice: 'Precio de venta',
		currentPurchasePrice: 'Precio compra (ref.)',
		currentSalePrice: 'Precio venta (ref.)',
		stock: 'Stock',
		minStock: 'Stock mínimo',
		imageUrl: 'Imagen',
		isActive: 'Activo'
	},
	customer: {
		firstName: 'Nombre',
		lastName: 'Apellido',
		idNumber: 'Cédula/ID',
		birthDate: 'Fecha de nacimiento',
		primaryPhone: 'Teléfono principal',
		email: 'Correo electrónico',
		address: 'Dirección',
		secondaryPhones: 'Teléfonos secundarios',
		notes: 'Notas'
	},
	prescription: {
		customerId: 'Cliente',
		prescriptionDate: 'Fecha de fórmula',
		odSphere: 'OD Esfera',
		odCylinder: 'OD Cilindro',
		odAxis: 'OD Eje',
		odAddition: 'OD Adición',
		osSphere: 'OS Esfera',
		osCylinder: 'OS Cilindro',
		osAxis: 'OS Eje',
		osAddition: 'OS Adición',
		dp: 'DP (Distancia Pupilar)',
		npRight: 'NP Derecho',
		npLeft: 'NP Izquierdo',
		treatments: 'Tratamientos',
		recommendedLensType: 'Tipo de lente recomendado',
		notes: 'Notas',
		doctorName: 'Médico',
		isCurrent: 'Fórmula actual'
	},
	sale: {
		customerId: 'Cliente',
		sellerId: 'Vendedor',
		saleDate: 'Fecha de venta',
		status: 'Estado',
		subtotal: 'Subtotal',
		discount: 'Descuento',
		total: 'Total',
		paymentMethod: 'Método de pago',
		notes: 'Notas'
	},
	sale_item: {
		saleId: 'Venta',
		productId: 'Producto',
		lensCatalogItemId: 'Lente del catálogo',
		selectedTreatments: 'Tratamientos seleccionados',
		quantity: 'Cantidad',
		unitPrice: 'Precio unitario',
		discount: 'Descuento',
		notes: 'Notas'
	},
	sale_item_free_details: {
		saleItemId: 'Ítem de venta',
		category: 'Categoría',
		description: 'Descripción',
		unitCost: 'Costo unitario',
		supplierId: 'Proveedor',
		opticalNotes: 'Notas ópticas',
		enrichmentStatus: 'Estado de completado',
		enrichedAt: 'Fecha de completado',
		enrichedById: 'Completado por'
	},
	lens_catalog_item: {
		supplierId: 'Proveedor',
		name: 'Nombre',
		type: 'Tipo',
		materialId: 'Material',
		hasAr: 'Antirreflejo',
		hasBluecut: 'Filtro azul',
		isPhotochromic: 'Fotocromático',
		priceType: 'Tipo de precio',
		basePrice: 'Precio base',
		mountingPrice: 'Precio montaje',
		shippingPrice: 'Precio envío',
		stock: 'Stock',
		notes: 'Notas',
		isActive: 'Activo',
		source: 'Origen'
	},
	supplier: {
		name: 'Nombre',
		type: 'Tipo',
		rif: 'RIF',
		primaryPhone: 'Teléfono principal',
		email: 'Correo electrónico',
		address: 'Dirección',
		secondaryPhones: 'Teléfonos secundarios',
		instagram: 'Instagram',
		whatsapp: 'WhatsApp',
		website: 'Sitio web',
		contactPersons: 'Personas de contacto',
		notes: 'Notas'
	},
	brand: {
		name: 'Nombre',
		description: 'Descripción',
		country: 'País',
		logoUrl: 'Logo',
		website: 'Sitio web'
	},
	material: {
		name: 'Nombre',
		code: 'Código',
		productType: 'Tipo de producto',
		description: 'Descripción',
		isActive: 'Activo'
	},
	lens_material: {
		name: 'Nombre',
		code: 'Código',
		refractiveIndex: 'Índice de refracción',
		description: 'Descripción',
		isActive: 'Activo'
	},
	lens_technology: {
		name: 'Nombre',
		supplierId: 'Proveedor',
		minFittingHeight: 'Altura mínima de montaje',
		isActive: 'Activo'
	},
	lens_differentiator: {
		nombre: 'Nombre'
	},
	lens_treatment: {
		name: 'Nombre',
		code: 'Código',
		description: 'Descripción',
		isActive: 'Activo'
	},
	sale_payment: {
		paymentMethod: 'Método de Pago',
		paymentDate: 'Fecha de Pago',
		amount: 'Monto',
		exchangeRate: 'Tasa de Cambio',
		bcvRate: 'Tasa BCV',
		amountBcvUsd: 'Monto USD BCV',
		reference: 'Referencia',
		notes: 'Notas',
		voidedAt: 'Anulado'
	},
	supplier_treatment: {
		name: 'Nombre',
		category: 'Categoría',
		price: 'Precio',
		isActive: 'Activo'
	},
	surplus_unit: {
		status: 'Estado',
		notes: 'Notas',
		reservedForSaleId: 'Reservado para venta',
		consumedBySaleId: 'Consumido por venta'
	},
	quote: {
		quoteNumber: 'Nro. Presupuesto',
		customerId: 'Cliente',
		sellerId: 'Vendedor',
		quoteDate: 'Fecha',
		status: 'Estado',
		subtotal: 'Subtotal',
		discount: 'Descuento',
		discountType: 'Tipo Descuento',
		total: 'Total',
		validUntil: 'Válido hasta',
		notes: 'Notas',
		conversionSaleId: 'Venta Convertida'
	},
	cash_expense: {
		category: 'Categoría',
		description: 'Descripción',
		currency: 'Moneda',
		amount: 'Monto',
		amountUsd: 'Equivalente USD',
		exchangeRate: 'Tasa',
		bcvRate: 'Tasa BCV',
		rateType: 'Tipo de tasa',
		expenseDate: 'Fecha del gasto',
		registeredById: 'Registrado por',
		reference: 'Referencia',
		notes: 'Notas',
		voidedAt: 'Anulado',
		voidedById: 'Anulado por',
		voidReason: 'Motivo de anulación'
	},
	purchase_order: {
		poNumber: 'Nro. Orden',
		supplierId: 'Proveedor',
		status: 'Estado',
		paymentTerms: 'Términos de pago',
		documentType: 'Tipo de documento',
		invoiceNumber: 'Nro. Factura',
		invoiceDate: 'Fecha de factura',
		discountType: 'Tipo de descuento',
		discountValue: 'Descuento',
		subtotal: 'Subtotal',
		total: 'Total',
		readyForReviewAt: 'Lista para revisión',
		confirmedAt: 'Confirmada',
		cancelledAt: 'Cancelada',
		notes: 'Notas',
		bcvRate: 'Tasa BCV',
		creditSchedule: 'Términos de crédito'
	},
	purchase_order_item: {
		productId: 'Producto',
		type: 'Tipo',
		quantity: 'Cantidad',
		unitPrice: 'Precio unitario',
		notes: 'Notas',
		isReviewed: 'Revisado'
	},
	purchase_order_payment: {
		currencyCode: 'Moneda',
		paymentDate: 'Fecha de pago',
		amount: 'Monto',
		bcvUsdRate: 'Tasa BCV',
		specificRate: 'Tasa usada',
		amountBs: 'Monto Bs.',
		amountUsdBcv: 'Monto USD BCV',
		reference: 'Referencia',
		notes: 'Notas',
		voidedAt: 'Anulado',
		voidedById: 'Anulado por'
	},
	purchase_order_early_payment_benefit: {
		purchaseOrderId: 'Orden de compra',
		paymentId: 'Pago asociado',
		benefitDate: 'Fecha del beneficio',
		amountUsdBcv: 'Monto USD BCV',
		appliedToBalance: 'Aplicado al saldo',
		note: 'Nota',
		createdById: 'Registrado por',
		voidedAt: 'Anulado',
		voidedById: 'Anulado por'
	}
};

/**
 * Get a human-readable label for a field.
 */
export function getFieldLabel(entityType: EntityType, field: string): string {
	return fieldLabels[entityType]?.[field] ?? field;
}

// ============================================================================
// ACTION LABELS
// ============================================================================

export const actionLabels: Record<ActionType, string> = {
	create: 'Creado',
	update: 'Actualizado',
	delete: 'Eliminado',
	restore: 'Restaurado'
};

export const actionIcons: Record<ActionType, string> = {
	create: '➕',
	update: '📝',
	delete: '🗑️',
	restore: '♻️'
};

// ============================================================================
// VALUE FORMATTING
// ============================================================================

/**
 * Format a change value for display.
 * Handles different types of values (booleans, dates, arrays, etc.)
 */
export function formatChangeValue(value: unknown): string {
	if (value === null || value === undefined) return '-';
	if (typeof value === 'boolean') return value ? 'Sí' : 'No';
	if (typeof value === 'number') return value.toLocaleString('es-VE');
	if (typeof value === 'string') {
		// Check if it's an ISO date string
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			const date = fromISODate(value);
			return date ? formatDate(date) : value;
		}
		if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
			return formatDate(fromISO(value));
		}
		return value;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return '(vacío)';
		return value.map((v) => formatChangeValue(v)).join(', ');
	}
	if (typeof value === 'object') {
		return JSON.stringify(value);
	}
	return String(value);
}

/**
 * Get a summary of what changed (e.g., "3 campos modificados")
 */
export function getChangeSummary(changes: ChangeRecord): string {
	const count = Object.keys(changes).length;
	if (count === 0) return 'Sin cambios';
	if (count === 1) return '1 campo modificado';
	return `${count} campos modificados`;
}
