import { z } from 'zod';
import { CoercedInteger } from './common';
import { ProductType } from '$lib/shared/enums';

export const INVENTORY_COUNT_SESSION_STATUSES = ['OPEN', 'APPLIED', 'CANCELLED'] as const;
export type InventoryCountSessionStatus = (typeof INVENTORY_COUNT_SESSION_STATUSES)[number];

export const INVENTORY_COUNT_SCOPE_TYPES = ['ALL', 'PRODUCT_CATEGORY', 'LENS'] as const;
export type InventoryCountScopeType = (typeof INVENTORY_COUNT_SCOPE_TYPES)[number];

export const INVENTORY_COUNT_ITEM_TYPES = ['PRODUCT', 'LENS'] as const;
export type InventoryCountItemType = (typeof INVENTORY_COUNT_ITEM_TYPES)[number];

export const INVENTORY_COUNT_LINE_FILTERS = ['ALL', 'COUNTED', 'PENDING', 'WITH_DIFF'] as const;
export type InventoryCountLineFilter = (typeof INVENTORY_COUNT_LINE_FILTERS)[number];

export const INVENTORY_COUNT_UI_FILTERS = ['ALL', 'PENDING', 'WITH_DIFF', 'OK'] as const;
export type InventoryCountUiFilter = (typeof INVENTORY_COUNT_UI_FILTERS)[number];

export const INVENTORY_COUNT_STATUS_LABELS: Record<InventoryCountSessionStatus, string> = {
	OPEN: 'Abierta',
	APPLIED: 'Aplicada',
	CANCELLED: 'Cancelada'
};

export function getInventoryCountStatusLabel(status: string) {
	return INVENTORY_COUNT_STATUS_LABELS[status as InventoryCountSessionStatus] ?? status;
}

export const INVENTORY_COUNT_SCOPE_LABELS: Record<InventoryCountScopeType, string> = {
	ALL: 'Todo el inventario',
	PRODUCT_CATEGORY: 'Solo productos',
	LENS: 'Solo lentes en stock'
};

export const INVENTORY_COUNT_LINE_FILTER_LABELS: Record<InventoryCountLineFilter, string> = {
	ALL: 'Todos',
	COUNTED: 'Contados',
	PENDING: 'Pendientes',
	WITH_DIFF: 'Con diferencia'
};

export const INVENTORY_COUNT_UI_FILTER_LABELS: Record<InventoryCountUiFilter, string> = {
	ALL: 'Todos',
	PENDING: 'Pendientes',
	WITH_DIFF: 'Con diferencia',
	OK: 'OK'
};

export function formatInventoryCountScope(scopeType: string, scopeValue?: string | null) {
	if (scopeType === 'PRODUCT_CATEGORY' && scopeValue) {
		return `${INVENTORY_COUNT_SCOPE_LABELS.PRODUCT_CATEGORY} - ${scopeValue}`;
	}

	return INVENTORY_COUNT_SCOPE_LABELS[scopeType as InventoryCountScopeType] ?? scopeType;
}

export const SessionIdSchema = z.object({
	id: CoercedInteger.min(1, 'Sesión inválida')
});

export const GetSessionsSchema = z.object({
	limit: CoercedInteger.min(1).max(100).optional().default(20)
});

export const GetSessionLinesSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida'),
	filter: z.enum(INVENTORY_COUNT_LINE_FILTERS).optional().default('ALL')
});

export const CreateInventoryCountSessionSchema = z
	.object({
		scopeType: z.enum(INVENTORY_COUNT_SCOPE_TYPES, 'Selecciona un alcance válido'),
		scopeValue: z.enum(ProductType).optional().nullable(),
		notes: z
			.string()
			.trim()
			.max(500, 'Las notas no pueden exceder 500 caracteres')
			.optional()
			.nullable()
	})
	.superRefine((data, ctx) => {
		if (data.scopeType !== 'PRODUCT_CATEGORY' && data.scopeValue) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Este alcance no usa categoría',
				path: ['scopeValue']
			});
		}
	});

export const UpsertInventoryCountLineSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida'),
	itemId: z.uuid('Ítem inválido'),
	itemType: z.enum(INVENTORY_COUNT_ITEM_TYPES, 'Tipo de ítem inválido'),
	countedStock: CoercedInteger.min(0, 'La cantidad contada no puede ser negativa'),
	notes: z.string().trim().max(240, 'La nota no puede exceder 240 caracteres').optional().nullable()
});

export const SetInventoryCountLineAdjustmentStatusSchema = z.object({
	lineId: CoercedInteger.min(1, 'Línea inválida'),
	adjustmentCompleted: z.boolean()
});

export const CancelInventoryCountSessionSchema = z.object({
	id: CoercedInteger.min(1, 'Sesión inválida'),
	reason: z.string().trim().min(5, 'Indica el motivo de cancelación').max(500)
});
