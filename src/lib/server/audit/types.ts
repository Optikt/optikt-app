import type { EntityType, ActionType, ChangeRecord } from '$lib/server/db/schema';

// ============================================================================
// AUDIT CONTEXT
// ============================================================================

/**
 * Context information for audit logging.
 * Passed to update/create/delete functions to capture who made the change.
 */
export interface AuditContext {
	/** ID of the user making the change (null for system changes) */
	userId?: string | null;
	/** IP address of the request */
	ipAddress?: string | null;
	/** User agent string from the request */
	userAgent?: string | null;
	/** Optional reason/description for the change */
	reason?: string | null;
}

// ============================================================================
// CHANGE HISTORY TYPES
// ============================================================================

export interface ChangeHistoryEntry {
	id: string;
	entityType: EntityType;
	entityId: string;
	action: ActionType;
	changedAt: Date;
	changedById: string | null;
	changedByName?: string | null; // Populated when fetching with user info
	changes: ChangeRecord;
	snapshot: Record<string, unknown> | null;
	reason: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: Date;
}

export interface ChangeHistoryOptions {
	limit?: number;
	offset?: number;
	actions?: ActionType[];
}

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
		prescriptionDate: 'Fecha de receta',
		odSphere: 'OD Esfera',
		odCylinder: 'OD Cilindro',
		odAxis: 'OD Eje',
		odAddition: 'OD Adición',
		osSphere: 'OS Esfera',
		osCylinder: 'OS Cilindro',
		osAxis: 'OS Eje',
		osAddition: 'OS Adición',
		pd: 'DP',
		pdRight: 'DP Derecho',
		pdLeft: 'DP Izquierdo',
		recommendedLensType: 'Tipo de lente recomendado',
		notes: 'Notas',
		doctorName: 'Médico',
		isCurrent: 'Receta actual'
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
	lens_catalog_item: {
		supplierId: 'Proveedor',
		name: 'Nombre',
		brand: 'Marca',
		type: 'Tipo',
		materialId: 'Material',
		sphereMin: 'Esfera mínima',
		sphereMax: 'Esfera máxima',
		cylinderMin: 'Cilindro mínimo',
		cylinderMax: 'Cilindro máximo',
		additionMin: 'Adición mínima',
		additionMax: 'Adición máxima',
		baseFeatures: 'Características base',
		isPhotochromic: 'Fotocromático',
		basePrice: 'Precio base',
		deliveryDays: 'Días de entrega',
		stock: 'Stock',
		refractiveIndex: 'Índice de refracción',
		notes: 'Notas',
		isActive: 'Activo'
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
	lens_material: {
		name: 'Nombre',
		code: 'Código',
		refractiveIndex: 'Índice de refracción',
		description: 'Descripción',
		isActive: 'Activo'
	},
	lens_treatment: {
		name: 'Nombre',
		code: 'Código',
		description: 'Descripción',
		isActive: 'Activo'
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
