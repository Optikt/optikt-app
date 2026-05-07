/**
 * Purchase Orders Remote Functions
 * Server-side functions for purchase order management
 */
import { query, command } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';
import { z } from 'zod';
import {
	ListPurchaseOrdersSchema,
	CreatePurchaseOrderSchema,
	UpdatePurchaseOrderSchema,
	SavePurchaseOrderDraftSchema,
	ConfirmPurchaseOrderSchema,
	CancelPurchaseOrderSchema,
	MarkPurchaseOrderReadySchema,
	TogglePurchaseOrderItemReviewedSchema,
	ApplyPriceSuggestionsSchema
} from '$lib/schemas/purchaseOrders';
import {
	getAllPurchaseOrders,
	countPurchaseOrders,
	getPurchaseOrderListStats as getPurchaseOrderListStatsQuery,
	findPurchaseOrderById,
	findPurchaseOrderByIdWithRelations,
	createPurchaseOrder,
	createPurchaseOrderItems,
	replacePurchaseOrderItems,
	updatePurchaseOrder,
	getPurchaseOrderItems,
	getNextPONumber,
	setPurchaseOrderReadyForReview,
	setPurchaseOrderItemReviewed,
	clearPurchaseOrderItemsReviewed,
	findPurchaseOrderItemById,
	confirmPurchaseOrder as confirmPO,
	cancelPurchaseOrder as cancelPO
} from '$lib/server/db/queries/purchaseOrders';
import { updateProduct, findProductById } from '$lib/server/db/queries/products';
import type {
	PurchaseOrderListStats,
	PurchaseOrderWithRelations,
	PurchaseOrderItemWithProduct,
	PurchaseOrderItemDraftInput
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { db } from '$lib/server/db';
import { PurchaseOrderItemType, PurchaseOrderStatus } from '$lib/shared/enums';
import { validatePurchaseOrderDraftReadiness } from '$lib/shared/purchaseOrderRules';
import { auditService, getAuditContext } from '$lib/server/audit';
import type { PaginatedResult } from '$lib/types';
import type { Supplier, PurchaseOrder } from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface PriceSuggestion {
	productId: string;
	productName: string;
	productSku: string;
	currentSalePrice: number | null;
	suggestedSalePrice: number;
}

export interface PurchaseOrderDetail {
	purchaseOrder: PurchaseOrderWithRelations;
	items: PurchaseOrderItemWithProduct[];
}

type SavePurchaseOrderDraftInput = z.infer<typeof SavePurchaseOrderDraftSchema>;

// ============================================================================
// QUERIES
// ============================================================================

export const listPurchaseOrders = query(
	ListPurchaseOrdersSchema,
	async (data): Promise<PaginatedResult<PurchaseOrderWithRelations>> => {
		requireAuth();

		const { page, perPage } = data;
		const filterOptions = {
			search: data.search ?? undefined,
			status: data.status ?? undefined,
			readyForReview: data.readyForReview ?? undefined,
			supplierId: data.supplierId ?? undefined,
			includeDeleted: data.includeDeleted
		};
		const [items, total] = await Promise.all([
			getAllPurchaseOrders({
				...filterOptions,
				limit: perPage,
				offset: (page - 1) * perPage,
				orderBy: 'orderDate',
				orderSort: 'desc'
			}),
			countPurchaseOrders(filterOptions)
		]);
		const totalPages = Math.ceil(total / perPage);
		return { items, total, page, perPage, totalPages };
	}
);

export const getPurchaseOrderDetail = query(
	ConfirmPurchaseOrderSchema, // reuse { id: z.uuid() }
	async (data): Promise<PurchaseOrderDetail | null> => {
		requireAuth();

		const po = await findPurchaseOrderByIdWithRelations(data.id);
		if (!po) return null;
		const items = await getPurchaseOrderItems(data.id);
		return { purchaseOrder: po, items };
	}
);

export const getSuppliersList = query(z.object({}), async (): Promise<Supplier[]> => {
	requireAuth();

	return getAllSuppliers({ includeDeleted: false });
});

export const getPurchaseOrderListStats = query(
	z.object({}),
	async (): Promise<PurchaseOrderListStats> => {
		requireAuth();

		return getPurchaseOrderListStatsQuery();
	}
);

// ============================================================================
// COMMANDS
// ============================================================================

export const createPurchaseOrderCmd = command(CreatePurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado' };
	}

	try {
		const result = await db.transaction(async (tx) => {
			const orderNumber = await getNextPONumber(tx);

			const po = await createPurchaseOrder(
				{
					orderNumber,
					supplierId: data.supplierId,
					documentType: data.documentType,
					invoiceNumber: data.invoiceNumber ?? null,
					deliveryNoteNumber: data.deliveryNoteNumber ?? null,
					orderDate: data.orderDate,
					bcvRate: data.bcvRate,
					notes: data.notes,
					status: PurchaseOrderStatus.DRAFT,
					isReadyForReview: false,
					createdById: context.userId!
				},
				tx
			);

			const itemsData = data.items.map((item) => ({
				purchaseOrderId: po.id,
				itemType: item.itemType,
				productId: item.productId ?? null,
				lensCatalogItemId: item.lensCatalogItemId ?? null,
				quantity: item.quantity,
				unitPurchasePrice: item.unitPurchasePrice,
				unitSalePrice: item.unitSalePrice,
				appliesIva: item.appliesIva,
				ivaRate: item.ivaRate
			}));

			await createPurchaseOrderItems(itemsData, tx);

			return po;
		});

		await auditService.logCreate('purchase_order' as never, result, context);

		return { success: true as const, purchaseOrder: result };
	} catch (e) {
		console.error('Error creating purchase order:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error creando orden de compra'
		};
	}
});

export const updatePurchaseOrderCmd = command(UpdatePurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar órdenes en borrador' };
	}

	try {
		const updateData: Partial<PurchaseOrder> = {};
		if (data.supplierId) updateData.supplierId = data.supplierId;
		if (data.documentType) updateData.documentType = data.documentType;
		if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber ?? null;
		if (data.deliveryNoteNumber !== undefined)
			updateData.deliveryNoteNumber = data.deliveryNoteNumber ?? null;
		if (data.orderDate) updateData.orderDate = data.orderDate;
		if (data.bcvRate !== undefined) updateData.bcvRate = data.bcvRate;
		if (data.notes !== undefined) updateData.notes = data.notes ?? null;
		updateData.isReadyForReview = false;

		const updated = await updatePurchaseOrder(data.id, updateData);

		await auditService.logUpdate('purchase_order' as never, data.id, existing, updated, context);

		return { success: true as const, purchaseOrder: updated };
	} catch (e) {
		console.error('Error updating purchase order:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error actualizando orden de compra'
		};
	}
});

function toPurchaseOrderItemDraftInput(
	item: SavePurchaseOrderDraftInput['items'][number]
): PurchaseOrderItemDraftInput {
	return {
		id: item.id,
		itemType: item.itemType as PurchaseOrderItemType,
		productId: item.productId ?? null,
		lensCatalogItemId: item.lensCatalogItemId ?? null,
		quantity: item.quantity,
		unitPurchasePrice: item.unitPurchasePrice,
		unitSalePrice: item.unitSalePrice,
		appliesIva: item.appliesIva,
		ivaRate: item.ivaRate,
		isReviewed: item.isReviewed
	};
}

async function getPurchaseOrderReadinessIssues(id: string): Promise<string[]> {
	const po = await findPurchaseOrderById(id);
	if (!po) return ['Orden de compra no encontrada'];

	const items = await getPurchaseOrderItems(id);
	const result = validatePurchaseOrderDraftReadiness(
		{
			supplierId: po.supplierId,
			orderDate: po.orderDate,
			bcvRate: po.bcvRate,
			notes: po.notes
		},
		items.map((item) => ({
			itemType: item.itemType,
			productId: item.productId,
			lensCatalogItemId: item.lensCatalogItemId,
			quantity: item.quantity,
			unitPurchasePrice: item.unitPurchasePrice,
			unitSalePrice: item.unitSalePrice,
			appliesIva: item.appliesIva,
			ivaRate: item.ivaRate
		}))
	);

	return result.issues;
}

export const savePurchaseOrderDraftCmd = command(SavePurchaseOrderDraftSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar órdenes en borrador' };
	}

	try {
		const result = await db.transaction(async (tx) => {
			const updated = await updatePurchaseOrder(
				data.id,
				{
					supplierId: data.supplierId,
					documentType: data.documentType,
					invoiceNumber: data.invoiceNumber ?? null,
					deliveryNoteNumber: data.deliveryNoteNumber ?? null,
					orderDate: data.orderDate,
					bcvRate: data.bcvRate,
					notes: data.notes,
					isReadyForReview: false
				},
				tx
			);

			// If the draft was previously "ready for review", any reviewer marks
			// must be discarded — saving from the editor reopens the draft and
			// the next review pass should start clean.
			if (existing.isReadyForReview) {
				await clearPurchaseOrderItemsReviewed(data.id, tx);
			}

			const items = await replacePurchaseOrderItems(
				data.id,
				data.items.map(toPurchaseOrderItemDraftInput),
				tx
			);

			return { purchaseOrder: updated, items };
		});

		await auditService.logUpdate(
			'purchase_order' as never,
			data.id,
			existing,
			result.purchaseOrder,
			context
		);

		return { success: true as const, ...result };
	} catch (e) {
		console.error('Error saving purchase order draft:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error guardando borrador de compra'
		};
	}
});

export const markPurchaseOrderReadyCmd = command(MarkPurchaseOrderReadySchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo los borradores pueden marcarse como listos' };
	}

	const issues = await getPurchaseOrderReadinessIssues(data.id);
	if (issues.length > 0) {
		return {
			success: false as const,
			error: `Completa el borrador antes de marcarlo como listo: ${issues.join(', ')}`
		};
	}

	try {
		const updated = await db.transaction(async (tx) =>
			setPurchaseOrderReadyForReview(data.id, true, tx)
		);
		await auditService.logUpdate('purchase_order' as never, data.id, existing, updated, context);
		return { success: true as const, purchaseOrder: updated };
	} catch (e) {
		console.error('Error marking purchase order ready:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error marcando orden como lista'
		};
	}
});

export const unmarkPurchaseOrderReadyCmd = command(MarkPurchaseOrderReadySchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo los borradores pueden volver a edición' };
	}

	try {
		const updated = await db.transaction(async (tx) =>
			setPurchaseOrderReadyForReview(data.id, false, tx)
		);
		await auditService.logUpdate('purchase_order' as never, data.id, existing, updated, context);
		return { success: true as const, purchaseOrder: updated };
	} catch (e) {
		console.error('Error unmarking purchase order ready:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error devolviendo orden a edición'
		};
	}
});

export const togglePurchaseOrderItemReviewedCmd = command(
	TogglePurchaseOrderItemReviewedSchema,
	async (data) => {
		requireAdmin();

		const context = getAuditContext();
		try {
			const item = await findPurchaseOrderItemById(data.id);
			if (!item) {
				return { success: false as const, error: 'Ítem no encontrado' };
			}
			const parent = await findPurchaseOrderById(item.purchaseOrderId);
			if (!parent) {
				return { success: false as const, error: 'Orden de compra no encontrada' };
			}
			if (parent.status !== PurchaseOrderStatus.DRAFT) {
				return {
					success: false as const,
					error: 'Solo se pueden marcar líneas en órdenes en borrador'
				};
			}

			const updated = await setPurchaseOrderItemReviewed(data.id, data.value);
			await auditService.logUpdate('purchase_order_item' as never, data.id, item, updated, context);
			return { success: true as const, item: updated };
		} catch (e) {
			console.error('Error toggling purchase order item reviewed:', e);
			return {
				success: false as const,
				error: e instanceof Error ? e.message : 'Error actualizando línea'
			};
		}
	}
);

export const confirmPurchaseOrderCmd = command(ConfirmPurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado', priceSuggestions: [] };
	}

	try {
		const result = await db.transaction(async (tx) => {
			return confirmPO(data.id, context.userId!, tx);
		});

		await auditService.logUpdate(
			'purchase_order' as never,
			data.id,
			{ status: PurchaseOrderStatus.DRAFT },
			{ status: PurchaseOrderStatus.CONFIRMED },
			context
		);

		// Collect price suggestions: compare PO item sale prices vs current product sale prices
		const poItems = await getPurchaseOrderItems(data.id);
		const suggestions: PriceSuggestion[] = [];

		for (const item of poItems) {
			if (!item.productId) continue;
			const product = await findProductById(item.productId);
			if (!product) continue;

			const current = product.currentSalePrice;
			const suggested = item.unitSalePrice;

			// Suggest only when PO price differs from current
			if (current === null || Number(current) !== Number(suggested)) {
				suggestions.push({
					productId: product.id,
					productName: product.name,
					productSku: product.sku,
					currentSalePrice: current !== null ? Number(current) : null,
					suggestedSalePrice: Number(suggested)
				});
			}
		}

		return { success: true as const, purchaseOrder: result, priceSuggestions: suggestions };
	} catch (e) {
		console.error('Error confirming purchase order:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error confirmando orden de compra',
			priceSuggestions: []
		};
	}
});

export const cancelPurchaseOrderCmd = command(CancelPurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	try {
		const result = await cancelPO(data.id);

		await auditService.logUpdate(
			'purchase_order' as never,
			data.id,
			{ status: PurchaseOrderStatus.DRAFT },
			{ status: PurchaseOrderStatus.CANCELLED },
			context
		);

		return { success: true as const, purchaseOrder: result };
	} catch (e) {
		console.error('Error cancelling purchase order:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error cancelando orden de compra'
		};
	}
});

export const applyPriceSuggestionsCmd = command(ApplyPriceSuggestionsSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado' };
	}

	try {
		const results: { productId: string; updated: boolean }[] = [];

		for (const { productId, newSalePrice } of data.updates) {
			const product = await findProductById(productId);
			if (!product) {
				results.push({ productId, updated: false });
				continue;
			}

			const old = { currentSalePrice: product.currentSalePrice };
			await updateProduct(productId, { currentSalePrice: newSalePrice });
			await auditService.logUpdate(
				'product' as never,
				productId,
				old,
				{ currentSalePrice: newSalePrice },
				context
			);
			results.push({ productId, updated: true });
		}

		const updatedCount = results.filter((r) => r.updated).length;
		return { success: true as const, updatedCount };
	} catch (e) {
		console.error('Error applying price suggestions:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error actualizando precios'
		};
	}
});
