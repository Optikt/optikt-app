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
	ConfirmPurchaseOrderSchema,
	CancelPurchaseOrderSchema,
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
	updatePurchaseOrder,
	getPurchaseOrderItems,
	getNextPONumber,
	confirmPurchaseOrder as confirmPO,
	cancelPurchaseOrder as cancelPO
} from '$lib/server/db/queries/purchaseOrders';
import { updateProduct, findProductById } from '$lib/server/db/queries/products';
import type {
	PurchaseOrderListStats,
	PurchaseOrderWithRelations,
	PurchaseOrderItemWithProduct
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { db } from '$lib/server/db';
import { PurchaseOrderStatus } from '$lib/shared/enums';
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
		if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber ?? null;
		if (data.deliveryNoteNumber !== undefined)
			updateData.deliveryNoteNumber = data.deliveryNoteNumber ?? null;
		if (data.orderDate) updateData.orderDate = data.orderDate;
		if (data.bcvRate !== undefined) updateData.bcvRate = data.bcvRate;
		if (data.notes !== undefined) updateData.notes = data.notes ?? null;

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
