/**
 * Quotes (Presupuestos) validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import {
	CoercedNumber,
	CoercedInteger,
	EntityIdSchema,
	ListPaginationSchema,
	OptionalSphereSchema,
	OptionalCylinderSchema,
	OptionalAdditionSchema
} from './common';
import { ALL_DISCOUNT_TYPES, DiscountType } from '$lib/shared/enums';
import { ALL_QUOTE_STATUSES } from '$lib/shared/contracts/quotes';
import {
	SaleItemType,
	ALL_FREE_ITEM_CATEGORIES,
	FreeItemCategory
} from '$lib/shared/enums/lensTypes';
import { AxisSchema, AlturaSchema } from '$lib/schemas/prescriptions';
import { InlineCustomerSchema } from '$lib/schemas/sales';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

const ALL_SALE_ITEM_TYPES = Object.values(SaleItemType) as [string, ...string[]];

// ============================================================================
// LIST / FILTER SCHEMAS
// ============================================================================

export const ListQuotesSchema = ListPaginationSchema.extend({
	status: z.enum(ALL_QUOTE_STATUSES).optional(),
	customerId: z.uuid().optional(),
	sellerId: z.uuid().optional(),
	dateFrom: z.iso.date().optional(),
	dateTo: z.iso.date().optional(),
	search: z.string().trim().optional()
});

// ============================================================================
// QUOTE ITEM SCHEMA (same polymorphic design as SaleItemSchema)
// ============================================================================

export const QuoteItemSchema = z
	.object({
		/** Optional client-generated UUID - used to link treatment items to their parent lens item */
		id: z.uuid().optional(),
		itemType: z.enum(ALL_SALE_ITEM_TYPES),
		productId: z.uuid().optional(),
		lensCatalogItemId: z.uuid().optional(),
		parentQuoteItemId: z.uuid().optional(),
		supplierTreatmentId: z.uuid().optional(),

		// Prescription snapshot
		odSphere: OptionalSphereSchema.optional(),
		odCylinder: OptionalCylinderSchema.optional(),
		odAxis: AxisSchema.optional(),
		odAddition: OptionalAdditionSchema.optional(),
		odAltura: AlturaSchema.optional(),
		osSphere: OptionalSphereSchema.optional(),
		osCylinder: OptionalCylinderSchema.optional(),
		osAxis: AxisSchema.optional(),
		osAddition: OptionalAdditionSchema.optional(),
		osAltura: AlturaSchema.optional(),

		quantity: CoercedInteger.min(1, 'Cantidad debe ser al menos 1'),
		unitPrice: CoercedNumber.min(0, 'Precio debe ser mayor o igual a 0'),
		discount: CoercedNumber.min(0).default(0),
		discountType: z.enum(ALL_DISCOUNT_TYPES).default(DiscountType.FIXED),

		// Snapshot fields
		snapshotName: z.string().optional(),
		snapshotSku: z.string().optional(),
		snapshotBrand: z.string().optional(),
		snapshotBaseCost: CoercedNumber.optional(),
		snapshotMountingPrice: CoercedNumber.optional(),
		snapshotShippingPrice: CoercedNumber.optional(),
		snapshotSalePrice: CoercedNumber.optional(),
		snapshotPriceType: z.string().optional(),
		snapshotTreatmentCategory: z.string().optional(),

		// Tax snapshot
		snapshotIsTaxable: z.boolean().optional(),

		// FREE_ITEM fields (only present when itemType === FREE_ITEM)
		freeItemCategory: z.enum(ALL_FREE_ITEM_CATEGORIES as [string, ...string[]]).optional(),
		freeItemDescription: z.string().min(3).max(500).optional(),
		freeItemUnitCost: CoercedNumber.min(0).optional(),
		freeItemSupplierId: z.uuid().optional(),
		freeItemOpticalNotes: z.string().max(1000).optional(),

		notes: z.string().optional()
	})
	.refine(
		(item) =>
			item.itemType !== SaleItemType.FREE_ITEM ||
			item.freeItemCategory === FreeItemCategory.SERVICE ||
			item.freeItemUnitCost == null ||
			item.freeItemUnitCost > 0,
		{
			message: 'El costo debe ser mayor a 0 para esta categoría',
			path: ['freeItemUnitCost']
		}
	);

// ============================================================================
// CREATE QUOTE SCHEMA
// ============================================================================

export const CreateQuoteSchema = z.object({
	/** Customer is optional at quote time */
	customerId: z.uuid().optional(),
	/** Inline new customer data (if no existing customerId) */
	newCustomer: InlineCustomerSchema.optional(),
	quoteDate: z.iso.date('Fecha del presupuesto inválida'),
	discount: CoercedNumber.min(0).default(0),
	discountType: z.enum(ALL_DISCOUNT_TYPES).default(DiscountType.FIXED),
	snapshotTaxRate: CoercedNumber.min(0).default(DEFAULT_TAX_RATE),
	validUntil: z.iso.date().optional(),
	notes: z.string().optional(),
	items: z.array(QuoteItemSchema).min(1, 'El presupuesto debe tener al menos un ítem')
});

// ============================================================================
// UPDATE QUOTE SCHEMA
// ============================================================================

export const UpdateQuoteSchema = z.object({
	id: z.uuid('ID de presupuesto inválido'),
	customerId: z.uuid().optional().nullable(),
	discount: CoercedNumber.min(0).optional(),
	discountType: z.enum(ALL_DISCOUNT_TYPES).optional(),
	snapshotTaxRate: CoercedNumber.min(0).optional(),
	validUntil: z.iso.date().optional().nullable(),
	notes: z.string().optional().nullable(),
	items: z.array(QuoteItemSchema).min(1, 'El presupuesto debe tener al menos un ítem')
});

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

export const AssignQuoteCustomerSchema = z
	.object({
		id: z.uuid('ID de presupuesto inválido'),
		customerId: z.uuid().optional(),
		newCustomer: InlineCustomerSchema.optional()
	})
	.refine((data) => data.customerId || data.newCustomer, {
		message: 'Debe indicar un cliente existente o los datos de uno nuevo'
	});

export const CancelQuoteSchema = z.object({
	id: z.uuid('ID de presupuesto inválido'),
	reason: z.string().optional()
});

export const ConvertQuoteSchema = z.object({
	id: z.uuid('ID de presupuesto inválido')
});

// ============================================================================
// ID SCHEMA
// ============================================================================

export const QuoteIdSchema = EntityIdSchema('Presupuesto');

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>;
export type QuoteItemInput = z.infer<typeof QuoteItemSchema>;
export type ListQuotesInput = z.infer<typeof ListQuotesSchema>;
