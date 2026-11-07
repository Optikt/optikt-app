import { z } from 'zod';
import { CoercedInteger } from './common/numbers';
import { ProductType } from '$lib/shared/enums';

/**
 * Validation schemas + server-side constants for the Conteo Físico module.
 * Display labels and cycle math live in `$lib/shared/inventoryCount` (client + server).
 */

export const INVENTORY_COUNT_SESSION_STATUSES = ['OPEN', 'APPLIED', 'CANCELLED'] as const;
export type InventoryCountSessionStatus = (typeof INVENTORY_COUNT_SESSION_STATUSES)[number];

/** Dimension of a session scope (new model). Legacy sessions delegate to scopeType/scopeValue. */
export const INVENTORY_COUNT_SCOPE_DIMS = ['ALL', 'BRAND', 'SUPPLIER', 'TYPE'] as const;
export type InventoryCountScopeDim = (typeof INVENTORY_COUNT_SCOPE_DIMS)[number];

/** Scope kinds supported at creation: structured dims plus the two keyboard shortcuts. */
export const INVENTORY_COUNT_SCOPE_KINDS = [
	'ALL',
	'BRAND',
	'SUPPLIER',
	'TYPE',
	'QUICK_OLDEST',
	'QUICK_NEVER'
] as const;
export type InventoryCountScopeKind = (typeof INVENTORY_COUNT_SCOPE_KINDS)[number];

export const INVENTORY_COUNT_ITEM_TYPES = ['PRODUCT', 'LENS'] as const;
export type InventoryCountItemType = (typeof INVENTORY_COUNT_ITEM_TYPES)[number];

export const INVENTORY_COUNT_LINE_FILTERS = ['ALL', 'COUNTED', 'PENDING', 'WITH_DIFF'] as const;
export type InventoryCountLineFilter = (typeof INVENTORY_COUNT_LINE_FILTERS)[number];

export const INVENTORY_COUNT_UI_FILTERS = ['ALL', 'PENDING', 'WITH_DIFF', 'ZERO_STOCK'] as const;
export type InventoryCountUiFilter = (typeof INVENTORY_COUNT_UI_FILTERS)[number];

export const INVENTORY_COUNT_DIMENSION_VALUES = ['BRAND', 'SUPPLIER', 'TYPE'] as const;
export type InventoryCountCoverageDim = (typeof INVENTORY_COUNT_DIMENSION_VALUES)[number];

export const INVENTORY_COUNT_ADJUSTMENT_REASONS = [
	'PHYSICAL_COUNT',
	'DAMAGE',
	'SAMPLE',
	'CUSTOMER_RETURN',
	'ENTRY_ERROR',
	'OTHER'
] as const;
export type InventoryCountAdjustmentReason = (typeof INVENTORY_COUNT_ADJUSTMENT_REASONS)[number];

// ── Zod schemas ─────────────────────────────────────────────────────────────

export const SessionIdSchema = z.object({
	id: CoercedInteger.min(1, 'Sesión inválida')
});

export const GetSessionsSchema = z.object({
	limit: CoercedInteger.min(1).max(100).optional().default(20),
	status: z.enum(INVENTORY_COUNT_SESSION_STATUSES).optional(),
	openedOn: z.iso.date('Fecha inválida').optional()
});

export const GetSessionLinesSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida'),
	filter: z.enum(INVENTORY_COUNT_LINE_FILTERS).optional().default('ALL')
});

/**
 * Legacy scope: kept only for backward compatibility with old clients.
 * New sessions use `scope` below.
 */
export const LegacyCreateSessionSchema = z.object({
	scopeType: z.enum(['ALL', 'PRODUCT_CATEGORY', 'LENS']),
	scopeValue: z.enum(ProductType).optional().nullable()
});

/** Structured scope (rediseño): dimensión + lista de valores, o un atajo con N. */
export const CountScopeKindSchema = z.enum(INVENTORY_COUNT_SCOPE_KINDS);

const CountScopeValuesShape = {
	dim: z.enum(INVENTORY_COUNT_SCOPE_DIMS, 'Selecciona una dimensión válida'),
	/** Ids de marca / proveedor, o valores de ProductType. */
	values: z.array(z.string().min(1)).max(30).default([]),
	quick: z.enum(['OLDEST', 'NEVER']).optional(),
	/** N del atajo (default: setting countQuickOldestLimit). */
	n: CoercedInteger.min(1).max(500).optional()
};

export const CreateCountSessionSchema = z
	.object({
		...CountScopeValuesShape,
		notes: z
			.string()
			.trim()
			.max(500, 'Las notas no pueden exceder 500 caracteres')
			.optional()
			.nullable(),
		responsibles: z
			.array(
				z.object({
					userId: z.uuid().optional(),
					displayName: z.string().trim().min(1).max(120),
					isExternal: z.boolean().default(false)
				})
			)
			.max(20)
			.default([])
	})
	.superRefine((data, ctx) => {
		if (data.quick != null && (data.values.length > 0 || data.dim !== 'ALL')) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Un atajo no admite valores de dimensión',
				path: ['values']
			});
		}
		if (data.quick == null && data.dim !== 'ALL' && data.values.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Selecciona al menos un valor para el alcance',
				path: ['values']
			});
		}
		if (data.quick == null && data.dim === 'ALL' && data.values.length > 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'El alcance "Todo" no admite valores',
				path: ['values']
			});
		}
	});

/** Upsert of the primary count input (fase Contar). Recounting resets derived fields. */
export const UpsertCountLineSchema = z.object({
	lineId: CoercedInteger.min(1, 'Línea inválida'),
	countedStock: CoercedInteger.min(0, 'La cantidad contada no puede ser negativa'),
	notes: z.string().trim().max(240, 'La nota no puede exceder 240 caracteres').optional()
});

/** Recount from the review phase (obligatorio sobre el umbral). */
export const RecountCountLineSchema = z.object({
	lineId: CoercedInteger.min(1, 'Línea inválida'),
	recountedStock: CoercedInteger.min(0, 'El recuento no puede ser negativo')
});

export const UpdateCountLineNotesSchema = z.object({
	lineId: CoercedInteger.min(1, 'Línea inválida'),
	notes: z.string().trim().max(240, 'La nota no puede exceder 240 caracteres')
});

/** Marca como contadas-en-0 todas las líneas con systemStock = 0 sin contar. */
export const ConfirmZeroStockSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida')
});

export const ReasonSchema = z.object({
	reason: z.enum(INVENTORY_COUNT_ADJUSTMENT_REASONS, 'Selecciona un motivo válido'),
	reasonText: z
		.string()
		.trim()
		.max(240, 'El texto no puede exceder 240 caracteres')
		.optional()
		.nullable()
});

export const ApplyCountLineAdjustmentSchema = z.object({
	lineId: CoercedInteger.min(1, 'Línea inválida'),
	...ReasonSchema.shape
});

export const ApplyAdjustmentsBatchSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida'),
	...ReasonSchema.shape
});

export const ListCountOptionsSchema = z.object({
	dim: z.enum(INVENTORY_COUNT_DIMENSION_VALUES)
});

export const PreviewCountScopeSchema = CreateCountSessionSchema.pick({
	dim: true,
	values: true,
	quick: true,
	n: true
});

export const GetDiffCostsSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida')
});

export const CountResponsibleEntrySchema = z.object({
	userId: z.uuid().optional(),
	displayName: z.string().trim().min(1).max(120),
	isExternal: z.boolean().default(false)
});

/** Sincroniza los responsables activos: se agregan los nuevos y se da de baja el resto. */
export const SetSessionResponsiblesSchema = z.object({
	sessionId: CoercedInteger.min(1, 'Sesión inválida'),
	entries: z.array(CountResponsibleEntrySchema).max(20)
});

export const UpdateCountSettingsSchema = z.object({
	cycleDays: CoercedInteger.min(1, 'El plazo debe ser al menos 1 día').max(365),
	diffThresholdUnits: CoercedInteger.min(0, 'El umbral no puede ser negativo').max(100),
	diffThresholdUsd: z.coerce.number().min(0, 'El umbral no puede ser negativo').max(1_000_000),
	quickOldestLimit: CoercedInteger.min(1, 'Debe ser al menos 1').max(500)
});

export const CancelInventoryCountSessionSchema = z.object({
	id: CoercedInteger.min(1, 'Sesión inválida'),
	reason: z.string().trim().min(5, 'Indica el motivo de cancelación').max(500)
});
