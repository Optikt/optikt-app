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
	CreatePurchaseOrderPaymentSchema,
	ListPurchaseOrderPaymentsSchema,
	VoidPurchaseOrderPaymentSchema
} from '$lib/schemas/purchaseOrderPayments';
import { SetPurchaseOrderCreditScheduleSchema } from '$lib/schemas/purchaseOrderCreditSchedule';
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
	findPurchaseOrderItemById,
	confirmPurchaseOrder as confirmPO,
	cancelPurchaseOrder as cancelPO
} from '$lib/server/db/queries/purchaseOrders';
import {
	createPurchaseOrderPayment,
	findPurchaseOrderPaymentById,
	getNextPurchaseOrderPaymentNumber,
	getPurchaseOrderPayments,
	voidPurchaseOrderPayment
} from '$lib/server/db/queries/purchaseOrderPayments';
import {
	getPurchaseOrderCreditSchedule,
	getUpcomingPurchaseOrderDueInstallments,
	replacePurchaseOrderCreditSchedule
} from '$lib/server/db/queries/purchaseOrderCreditSchedule';
import { updateProduct, findProductById } from '$lib/server/db/queries/products';
import type {
	PurchaseOrderListStats,
	PurchaseOrderWithRelations,
	PurchaseOrderItemWithProduct,
	PurchaseOrderItemDraftInput
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { db } from '$lib/server/db';
import {
	PurchaseOrderItemType,
	PurchaseOrderStatus,
	PurchasePaymentTerms
} from '$lib/shared/enums';
import { validatePurchaseOrderDraftReadiness } from '$lib/shared/purchaseOrderRules';
import {
	calculatePurchaseOrderDebtTotal,
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus,
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';
import { normalizePurchasePaymentAmounts } from '$lib/shared/purchaseOrderPayments';
import { auditService, getAuditContext } from '$lib/server/audit';
import type { PaginatedResult } from '$lib/types';
import type {
	PurchaseOrder,
	PurchaseOrderCreditInstallment,
	PurchaseOrderPayment,
	Supplier
} from '$lib/server/db/schema';

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
	payments: PurchaseOrderPayment[];
	creditSchedule: PurchaseOrderCreditInstallment[];
	balance: PurchaseOrderBalanceSummary;
	dueStatus: PurchaseOrderDueStatus;
}

type SavePurchaseOrderDraftInput = z.infer<typeof SavePurchaseOrderDraftSchema>;
type PurchaseOrderFinancialDraftItem = Pick<
	SavePurchaseOrderDraftInput['items'][number],
	'quantity' | 'unitPurchasePrice' | 'appliesIva' | 'ivaRate'
>;
type PurchaseOrderFinanceInstallmentLike = {
	installmentNumber: number;
	dueDate: string;
	expectedAmountUsd?: number | null;
	earlyPaymentDiscountPercent?: number | null;
	earlyPaymentDiscountDeadline?: string | null;
	notes?: string | null;
};

const FINANCE_VALIDATION_UUID = '00000000-0000-0000-0000-000000000000';

function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

function uniqueIssues(issues: string[]): string[] {
	return [...new Set(issues.filter(Boolean))];
}

function toPurchaseOrderCreditScheduleDraftInput(
	installment: PurchaseOrderFinanceInstallmentLike,
	index: number
) {
	return {
		installmentNumber: installment.installmentNumber ?? index + 1,
		dueDate: installment.dueDate,
		expectedAmountUsd: installment.expectedAmountUsd ?? null,
		earlyPaymentDiscountPercent: installment.earlyPaymentDiscountPercent ?? null,
		earlyPaymentDiscountDeadline: installment.earlyPaymentDiscountDeadline ?? null,
		notes: installment.notes?.trim() ? installment.notes.trim() : null
	};
}

function getPurchaseOrderFinanceIssues({
	purchaseOrderId,
	paymentTerms,
	installments,
	items,
	discount
}: {
	purchaseOrderId: string;
	paymentTerms: PurchasePaymentTerms;
	installments: PurchaseOrderFinanceInstallmentLike[];
	items: PurchaseOrderFinancialDraftItem[];
	discount:
		| {
				type?: string | null;
				value?: number | null;
		  }
		| undefined;
}): string[] {
	const normalizedInstallments = installments.map((installment) => ({
		installmentNumber: installment.installmentNumber,
		dueDate: installment.dueDate,
		expectedAmountUsd: installment.expectedAmountUsd ?? undefined,
		earlyPaymentDiscountPercent: installment.earlyPaymentDiscountPercent ?? undefined,
		earlyPaymentDiscountDeadline: installment.earlyPaymentDiscountDeadline ?? undefined,
		notes: installment.notes ?? undefined
	}));

	const parsed = SetPurchaseOrderCreditScheduleSchema.safeParse({
		purchaseOrderId,
		paymentTerms,
		installments: normalizedInstallments
	});

	const issues = parsed.success
		? []
		: parsed.error.issues.map((issue) => issue.message).filter(Boolean);

	if (paymentTerms !== PurchasePaymentTerms.CREDIT) {
		return uniqueIssues(issues);
	}

	let previousDueDate = '';
	for (const [index, installment] of normalizedInstallments.entries()) {
		const label = `Cuota ${index + 1}`;

		if (previousDueDate && installment.dueDate < previousDueDate) {
			issues.push(`${label}: la fecha debe ser igual o posterior a la cuota anterior`);
		}

		if (
			installment.earlyPaymentDiscountDeadline &&
			installment.earlyPaymentDiscountDeadline > installment.dueDate
		) {
			issues.push(`${label}: la fecha de pronto pago no puede ser posterior al vencimiento`);
		}

		previousDueDate = installment.dueDate;
	}

	const totalDebt = roundCurrency(
		calculatePurchaseOrderDebtTotal(items, {
			settlementDiscountType: discount?.type ?? 'NONE',
			settlementDiscountValue: discount?.value ?? 0
		})
	);
	const scheduledAmount = roundCurrency(
		normalizedInstallments.length === 1 && normalizedInstallments[0]?.expectedAmountUsd == null
			? totalDebt
			: normalizedInstallments.reduce(
					(sum, installment) => sum + Number(installment.expectedAmountUsd ?? 0),
					0
				)
	);

	if (Math.abs(totalDebt - scheduledAmount) > 0.01) {
		issues.push(
			`La suma de cuotas (${scheduledAmount.toFixed(2)}) debe coincidir con el total neto (${totalDebt.toFixed(2)})`
		);
	}

	return uniqueIssues(issues);
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
			readyForReview: data.readyForReview ?? undefined,
			supplierId: data.supplierId ?? undefined,
			includeDeleted: data.includeDeleted
		};
		const [items, total] = await Promise.all([
			getAllPurchaseOrders({
				...filterOptions,
				limit: perPage,
				offset: (page - 1) * perPage,
				orderBy: data.orderBy ?? 'orderNumber',
				orderSort: data.orderSort ?? 'desc'
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
		const [items, payments, creditSchedule] = await Promise.all([
			getPurchaseOrderItems(data.id),
			getPurchaseOrderPayments(data.id, { includeVoided: true }),
			getPurchaseOrderCreditSchedule(data.id)
		]);
		const balance = computePurchaseOrderBalance(po, items, payments, creditSchedule);
		const dueStatus = getPurchaseOrderDueStatus({
			paymentTerms: po.paymentTerms,
			installments: creditSchedule,
			balance: balance.balance
		});

		return { purchaseOrder: po, items, payments, creditSchedule, balance, dueStatus };
	}
);

export const getPurchaseOrderPaymentsQuery = query(
	ListPurchaseOrderPaymentsSchema,
	async (data): Promise<PurchaseOrderPayment[]> => {
		requireAuth();
		return getPurchaseOrderPayments(data.purchaseOrderId, {
			includeVoided: data.includeVoided
		});
	}
);

export const getUpcomingPurchaseOrderDueInstallmentsQuery = query(
	z.object({
		dateFrom: z.iso.date('Fecha inicial requerida'),
		dateTo: z.iso.date('Fecha final requerida')
	}),
	async (data) => {
		requireAuth();
		return getUpcomingPurchaseOrderDueInstallments(data.dateFrom, data.dateTo);
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

	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: FINANCE_VALIDATION_UUID,
		paymentTerms: data.paymentTerms,
		installments: data.installments,
		items: data.items,
		discount: data.discount
	});
	if (financeIssues.length > 0) {
		return {
			success: false as const,
			error: `Completa la condición de pago antes de guardar: ${financeIssues.join(', ')}`
		};
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
					paymentTerms: data.paymentTerms,
					notes: data.notes,
					settlementDiscountType: data.discount?.type ?? 'NONE',
					settlementDiscountValue: data.discount?.value ?? 0,
					settlementDiscountNotes: data.discount?.notes ?? null,
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
				ivaRate: item.ivaRate,
				isReviewed: item.isReviewed ?? false
			}));

			await createPurchaseOrderItems(itemsData, tx);
			await replacePurchaseOrderCreditSchedule(
				po.id,
				data.paymentTerms === PurchasePaymentTerms.CONTADO
					? []
					: data.installments.map(toPurchaseOrderCreditScheduleDraftInput),
				tx
			);

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
	if (existing.isReadyForReview) {
		return {
			success: false as const,
			error: 'La orden está lista para revisar. Vuelve a borrador antes de editarla.'
		};
	}

	try {
		const nextPaymentTerms = data.paymentTerms ?? (existing.paymentTerms as PurchasePaymentTerms);
		const nextInstallments = data.installments ?? (await getPurchaseOrderCreditSchedule(data.id));
		const nextItems = await getPurchaseOrderItems(data.id);
		const financeIssues = getPurchaseOrderFinanceIssues({
			purchaseOrderId: data.id,
			paymentTerms: nextPaymentTerms,
			installments: nextInstallments,
			items: nextItems,
			discount: {
				type: data.discount?.type ?? existing.settlementDiscountType,
				value: data.discount?.value ?? existing.settlementDiscountValue
			}
		});
		if (financeIssues.length > 0) {
			return {
				success: false as const,
				error: `Completa la condición de pago antes de guardar: ${financeIssues.join(', ')}`
			};
		}

		const updateData: Partial<PurchaseOrder> = {};
		if (data.supplierId) updateData.supplierId = data.supplierId;
		if (data.documentType) updateData.documentType = data.documentType;
		if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber ?? null;
		if (data.deliveryNoteNumber !== undefined)
			updateData.deliveryNoteNumber = data.deliveryNoteNumber ?? null;
		if (data.orderDate) updateData.orderDate = data.orderDate;
		if (data.bcvRate !== undefined) updateData.bcvRate = data.bcvRate;
		if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
		if (data.notes !== undefined) updateData.notes = data.notes ?? null;
		if (data.discount !== undefined) {
			updateData.settlementDiscountType = data.discount.type;
			updateData.settlementDiscountValue = data.discount.value;
			updateData.settlementDiscountNotes = data.discount.notes ?? null;
		}
		updateData.isReadyForReview = false;

		const updated = await db.transaction(async (tx) => {
			const purchaseOrder = await updatePurchaseOrder(data.id, updateData, tx);

			if (data.paymentTerms !== undefined || data.installments !== undefined) {
				await replacePurchaseOrderCreditSchedule(
					data.id,
					nextPaymentTerms === PurchasePaymentTerms.CONTADO
						? []
						: nextInstallments.map(toPurchaseOrderCreditScheduleDraftInput),
					tx
				);
			}

			return purchaseOrder;
		});

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

	const [items, creditSchedule] = await Promise.all([
		getPurchaseOrderItems(id),
		getPurchaseOrderCreditSchedule(id)
	]);
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
	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: id,
		paymentTerms: po.paymentTerms as PurchasePaymentTerms,
		installments: creditSchedule,
		items,
		discount: {
			type: po.settlementDiscountType,
			value: po.settlementDiscountValue
		}
	});

	return [...result.issues, ...financeIssues];
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
	if (existing.isReadyForReview) {
		return {
			success: false as const,
			error: 'La orden está lista para revisar. Vuelve a borrador antes de editarla.'
		};
	}

	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: data.id,
		paymentTerms: data.paymentTerms,
		installments: data.installments,
		items: data.items,
		discount: data.discount
	});
	if (financeIssues.length > 0) {
		return {
			success: false as const,
			error: `Completa la condición de pago antes de guardar: ${financeIssues.join(', ')}`
		};
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
					paymentTerms: data.paymentTerms,
					notes: data.notes,
					settlementDiscountType: data.discount?.type ?? 'NONE',
					settlementDiscountValue: data.discount?.value ?? 0,
					settlementDiscountNotes: data.discount?.notes ?? null,
					isReadyForReview: false
				},
				tx
			);

			const items = await replacePurchaseOrderItems(
				data.id,
				data.items.map(toPurchaseOrderItemDraftInput),
				tx
			);
			const creditSchedule = await replacePurchaseOrderCreditSchedule(
				data.id,
				data.paymentTerms === PurchasePaymentTerms.CONTADO
					? []
					: data.installments.map(toPurchaseOrderCreditScheduleDraftInput),
				tx
			);

			return { purchaseOrder: updated, items, creditSchedule };
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
			setPurchaseOrderReadyForReview(data.id, true, tx, data.clearReviewed)
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
			setPurchaseOrderReadyForReview(data.id, false, tx, data.clearReviewed)
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

export const addPurchaseOrderPaymentCmd = command(
	CreatePurchaseOrderPaymentSchema,
	async (data) => {
		requireAdmin();

		const context = getAuditContext();
		if (!context.userId) {
			return { success: false as const, error: 'No autorizado' };
		}

		const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
		if (!purchaseOrder) {
			return { success: false as const, error: 'Orden de compra no encontrada' };
		}
		if (purchaseOrder.status !== PurchaseOrderStatus.CONFIRMED) {
			return {
				success: false as const,
				error: 'Solo se pueden registrar pagos en órdenes confirmadas'
			};
		}

		const normalized = normalizePurchasePaymentAmounts({
			currencyCode: data.currencyCode,
			amount: data.amount,
			bcvUsdRate: data.bcvUsdRate,
			specificRate: data.specificRate
		});

		if (normalized.amountBs <= 0 || normalized.amountUsdBcv <= 0) {
			return {
				success: false as const,
				error: 'No se pudo calcular el equivalente en USD BCV del pago'
			};
		}

		try {
			const result = await db.transaction(async (tx) => {
				const paymentNumber = await getNextPurchaseOrderPaymentNumber(data.purchaseOrderId, tx);
				const payment = await createPurchaseOrderPayment(
					{
						purchaseOrderId: data.purchaseOrderId,
						paymentNumber,
						currencyCode: data.currencyCode,
						paymentDate: data.paymentDate,
						amount: data.amount,
						bcvUsdRate: data.bcvUsdRate,
						specificRate: data.specificRate ?? null,
						amountBs: normalized.amountBs,
						amountUsdBcv: normalized.amountUsdBcv,
						reference: data.reference ?? null,
						notes: data.notes ?? null,
						createdById: context.userId!
					},
					tx
				);

				const [items, payments, creditSchedule] = await Promise.all([
					getPurchaseOrderItems(data.purchaseOrderId, tx),
					getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
					getPurchaseOrderCreditSchedule(data.purchaseOrderId, tx)
				]);

				const balance = computePurchaseOrderBalance(purchaseOrder, items, payments, creditSchedule);
				const dueStatus = getPurchaseOrderDueStatus({
					paymentTerms: purchaseOrder.paymentTerms,
					installments: creditSchedule,
					balance: balance.balance
				});

				return { payment, balance, dueStatus };
			});

			await auditService.logCreate('purchase_order_payment' as never, result.payment, context, {
				excludeFields: ['createdAt', 'updatedAt']
			});

			return { success: true as const, ...result };
		} catch (e) {
			console.error('Error adding purchase order payment:', e);
			return {
				success: false as const,
				error: e instanceof Error ? e.message : 'Error registrando pago'
			};
		}
	}
);

export const voidPurchaseOrderPaymentCmd = command(VoidPurchaseOrderPaymentSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
	if (!purchaseOrder) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}

	const payment = await findPurchaseOrderPaymentById(data.id);
	if (!payment || payment.purchaseOrderId !== data.purchaseOrderId) {
		return { success: false as const, error: 'Pago no encontrado' };
	}

	try {
		const result = await db.transaction(async (tx) => {
			const voided = await voidPurchaseOrderPayment(data.id, tx);
			if (!voided) {
				throw new Error('No se pudo anular el pago');
			}

			const [items, payments, creditSchedule] = await Promise.all([
				getPurchaseOrderItems(data.purchaseOrderId, tx),
				getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
				getPurchaseOrderCreditSchedule(data.purchaseOrderId, tx)
			]);

			const balance = computePurchaseOrderBalance(purchaseOrder, items, payments, creditSchedule);
			const dueStatus = getPurchaseOrderDueStatus({
				paymentTerms: purchaseOrder.paymentTerms,
				installments: creditSchedule,
				balance: balance.balance
			});

			return { voided, balance, dueStatus };
		});

		await auditService.logUpdate(
			'purchase_order_payment' as never,
			data.id,
			payment,
			result.voided,
			context,
			{ excludeFields: ['createdAt', 'updatedAt'] }
		);

		return { success: true as const, ...result };
	} catch (e) {
		console.error('Error voiding purchase order payment:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error anulando pago'
		};
	}
});

export const setPurchaseOrderCreditScheduleCmd = command(
	SetPurchaseOrderCreditScheduleSchema,
	async (data) => {
		requireAdmin();

		const context = getAuditContext();
		const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
		if (!purchaseOrder) {
			return { success: false as const, error: 'Orden de compra no encontrada' };
		}
		if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
			return {
				success: false as const,
				error: 'No se puede configurar crédito en una orden cancelada'
			};
		}

		const existingSchedule = await getPurchaseOrderCreditSchedule(data.purchaseOrderId);

		try {
			const result = await db.transaction(async (tx) => {
				const updatedPurchaseOrder = await updatePurchaseOrder(
					data.purchaseOrderId,
					{ paymentTerms: data.paymentTerms },
					tx
				);
				const creditSchedule = await replacePurchaseOrderCreditSchedule(
					data.purchaseOrderId,
					data.installments.map((installment) => ({
						installmentNumber: installment.installmentNumber,
						dueDate: installment.dueDate,
						expectedAmountUsd: installment.expectedAmountUsd ?? null,
						earlyPaymentDiscountPercent: installment.earlyPaymentDiscountPercent ?? null,
						earlyPaymentDiscountDeadline: installment.earlyPaymentDiscountDeadline ?? null,
						notes: installment.notes ?? null
					})),
					tx
				);

				const [items, payments] = await Promise.all([
					getPurchaseOrderItems(data.purchaseOrderId, tx),
					getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx)
				]);

				const balance = computePurchaseOrderBalance(
					updatedPurchaseOrder,
					items,
					payments,
					creditSchedule
				);
				const dueStatus = getPurchaseOrderDueStatus({
					paymentTerms: updatedPurchaseOrder.paymentTerms,
					installments: creditSchedule,
					balance: balance.balance
				});

				return { updatedPurchaseOrder, creditSchedule, balance, dueStatus };
			});

			await auditService.logCustom(
				'purchase_order' as never,
				data.purchaseOrderId,
				'update',
				{
					paymentTerms: {
						old: purchaseOrder.paymentTerms,
						new: result.updatedPurchaseOrder.paymentTerms
					},
					creditSchedule: {
						old: existingSchedule,
						new: result.creditSchedule
					}
				},
				context
			);

			return {
				success: true as const,
				purchaseOrder: result.updatedPurchaseOrder,
				creditSchedule: result.creditSchedule,
				balance: result.balance,
				dueStatus: result.dueStatus
			};
		} catch (e) {
			console.error('Error setting purchase order credit schedule:', e);
			return {
				success: false as const,
				error: e instanceof Error ? e.message : 'Error configurando crédito'
			};
		}
	}
);

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
