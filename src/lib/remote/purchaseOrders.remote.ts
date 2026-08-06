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
import { SetPurchaseOrderCreditTermsSchema } from '$lib/schemas/purchaseOrderCreditSchedule';
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
	getPurchaseOrderPaymentsWithUsers,
	voidPurchaseOrderPayment
} from '$lib/server/db/queries/purchaseOrderPayments';
import { getUpcomingPurchaseOrderDues } from '$lib/server/db/queries/purchaseOrderCreditSchedule';
import {
	createPurchaseOrderEarlyPaymentBenefit,
	getPurchaseOrderEarlyPaymentBenefits,
	voidPurchaseOrderEarlyPaymentBenefitsByPayment
} from '$lib/server/db/queries/purchaseOrderEarlyPaymentBenefits';
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
	PurchasePaymentTerms,
	currencyForPurchasePaymentMethod
} from '$lib/shared/enums';
import { assignPurchaseOrderLineNumbers } from '$lib/shared/purchaseOrderLineNumbers';
import { validatePurchaseOrderDraftReadiness } from '$lib/shared/purchaseOrderRules';
import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus,
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';
import { normalizePurchasePaymentAmounts } from '$lib/shared/purchaseOrderPayments';
import { SOURCE_TO_CURRENCY_CODE } from '$lib/shared/purchaseOrderCurrencies';
import { auditService, getAuditContext } from '$lib/server/audit';
import type { PaginatedResult } from '$lib/types';
import type {
	PurchaseOrder,
	PurchaseOrderEarlyPaymentBenefit,
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
	earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
	balance: PurchaseOrderBalanceSummary;
	dueStatus: PurchaseOrderDueStatus;
}

type SavePurchaseOrderDraftInput = z.infer<typeof SavePurchaseOrderDraftSchema>;

type PurchaseOrderCreditTermsInput = {
	purchaseOrderId: string;
	paymentTerms: PurchasePaymentTerms;
	creditDueDate?: string | null;
	earlyPaymentDiscountPercent?: number | null;
	earlyPaymentDiscountDeadline?: string | null;
};

function uniqueIssues(issues: string[]): string[] {
	return [...new Set(issues.filter(Boolean))];
}

function normalizeCreditTermsForWrite(
	terms: Omit<PurchaseOrderCreditTermsInput, 'purchaseOrderId'>
): Pick<
	PurchaseOrder,
	'paymentTerms' | 'creditDueDate' | 'earlyPaymentDiscountPercent' | 'earlyPaymentDiscountDeadline'
> {
	if (terms.paymentTerms === PurchasePaymentTerms.CONTADO) {
		return {
			paymentTerms: terms.paymentTerms,
			creditDueDate: null,
			earlyPaymentDiscountPercent: null,
			earlyPaymentDiscountDeadline: null
		};
	}

	const earlyPaymentDiscountPercent = Number(terms.earlyPaymentDiscountPercent ?? 0);
	return {
		paymentTerms: terms.paymentTerms,
		creditDueDate: terms.creditDueDate ?? null,
		earlyPaymentDiscountPercent:
			earlyPaymentDiscountPercent > 0 ? earlyPaymentDiscountPercent : null,
		earlyPaymentDiscountDeadline:
			earlyPaymentDiscountPercent > 0 ? (terms.earlyPaymentDiscountDeadline ?? null) : null
	};
}

function getPurchaseOrderFinanceIssues(terms: PurchaseOrderCreditTermsInput): string[] {
	const parsed = SetPurchaseOrderCreditTermsSchema.safeParse(terms);
	return parsed.success
		? []
		: uniqueIssues(parsed.error.issues.map((issue) => issue.message).filter(Boolean));
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
			hasPendingBalance: data.hasPendingBalance ?? undefined,
			hasOverdueBalance: data.hasOverdueBalance ?? undefined,
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
		const [items, payments, earlyPaymentBenefits] = await Promise.all([
			getPurchaseOrderItems(data.id),
			getPurchaseOrderPayments(data.id, { includeVoided: true }),
			getPurchaseOrderEarlyPaymentBenefits(data.id, { includeVoided: true })
		]);
		const balance = computePurchaseOrderBalance(po, items, payments, earlyPaymentBenefits);
		const dueStatus = getPurchaseOrderDueStatus({
			paymentTerms: po.paymentTerms,
			creditDueDate: po.creditDueDate,
			earlyPaymentDiscountDeadline: po.earlyPaymentDiscountDeadline,
			balance: balance.balance
		});

		return { purchaseOrder: po, items, payments, earlyPaymentBenefits, balance, dueStatus };
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

export const getUpcomingPurchaseOrderDuesQuery = query(
	z.object({
		dateFrom: z.iso.date('Fecha inicial requerida'),
		dateTo: z.iso.date('Fecha final requerida')
	}),
	async (data) => {
		requireAuth();
		return getUpcomingPurchaseOrderDues(data.dateFrom, data.dateTo);
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
		purchaseOrderId: data.supplierId,
		paymentTerms: data.paymentTerms,
		creditDueDate: data.creditDueDate,
		earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
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
			const creditTerms = normalizeCreditTermsForWrite({
				paymentTerms: data.paymentTerms,
				creditDueDate: data.creditDueDate,
				earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
			});

			const sourceCurrency = data.sourceCurrency ?? 'USD';
			const settlementCurrency =
				data.settlementCurrency ??
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
				'USD_BCV';

			const po = await createPurchaseOrder(
				{
					orderNumber,
					supplierId: data.supplierId,
					documentType: data.documentType,
					invoiceNumber: data.invoiceNumber ?? null,
					deliveryNoteNumber: data.deliveryNoteNumber ?? null,
					orderDate: data.orderDate,
					bcvRate: data.bcvRate,
					sourceRateToVes: data.altRate ?? null,
					sourceCurrency: data.sourceCurrency,
					settlementCurrency,
					...creditTerms,
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

			const itemsData = assignPurchaseOrderLineNumbers(
				data.items.map((item) => ({
					purchaseOrderId: po.id,
					itemType: item.itemType,
					productId: item.productId ?? null,
					lensCatalogItemId: item.lensCatalogItemId ?? null,
					quantity: item.quantity,
					unitPurchasePrice: item.unitPurchasePrice,
					unitPurchasePriceAlt: item.unitPurchasePriceAlt ?? null,
					unitSalePrice: item.unitSalePrice,
					isZeroPriceIntentional: item.isZeroPriceIntentional ?? false,
					appliesIva: item.appliesIva,
					ivaRate: item.ivaRate,
					isReviewed: item.isReviewed ?? false
				}))
			);

			await createPurchaseOrderItems(itemsData, tx);

			// Compute and persist settlement amounts from items
			const isNativeSettlement = settlementCurrency !== 'USD_BCV';
			const gross = itemsData.reduce(
				(sum, item) =>
					sum +
					(isNativeSettlement
						? Number(item.unitPurchasePriceAlt ?? item.unitPurchasePrice ?? 0)
						: Number(item.unitPurchasePrice || 0)) *
						Number(item.quantity || 0),
				0
			);
			const usdBcvGross = itemsData.reduce(
				(sum, item) => sum + Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0),
				0
			);
			const discountType = data.discount?.type;
			const discountValue = Number(data.discount?.value ?? 0);
			let settlementDebtAmount = gross;
			let discountFactor = 1;
			if (discountType === 'PERCENT' && discountValue > 0) {
				discountFactor = 1 - Math.min(discountValue, 100) / 100;
				settlementDebtAmount = gross * discountFactor;
			} else if (discountType === 'AMOUNT' && discountValue > 0) {
				settlementDebtAmount = Math.max(0, gross - discountValue);
				discountFactor = gross > 0 ? settlementDebtAmount / gross : 0;
			}
			const settlementUpdate = {
				settlementGrossAmount: data.settlementGrossAmount ?? gross,
				settlementDebtAmount: data.settlementDebtAmount ?? settlementDebtAmount,
				settlementDebtAmountUsdBcvAtOrder: isNativeSettlement
					? Math.round(usdBcvGross * discountFactor * 100) / 100
					: settlementDebtAmount
			};
			if (
				settlementUpdate.settlementGrossAmount !== 0 ||
				settlementUpdate.settlementDebtAmount !== 0
			) {
				await updatePurchaseOrder(po.id, settlementUpdate, tx);
			}

			return po;
		});

		await auditService.logCreate('purchase_order', result, context);

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
		const nextCreditDueDate =
			data.creditDueDate !== undefined ? data.creditDueDate : existing.creditDueDate;
		const nextEarlyPaymentDiscountPercent =
			data.earlyPaymentDiscountPercent !== undefined
				? data.earlyPaymentDiscountPercent
				: existing.earlyPaymentDiscountPercent;
		const nextEarlyPaymentDiscountDeadline =
			data.earlyPaymentDiscountDeadline !== undefined
				? data.earlyPaymentDiscountDeadline
				: existing.earlyPaymentDiscountDeadline;
		const financeIssues = getPurchaseOrderFinanceIssues({
			purchaseOrderId: data.id,
			paymentTerms: nextPaymentTerms,
			creditDueDate: nextCreditDueDate,
			earlyPaymentDiscountPercent: nextEarlyPaymentDiscountPercent,
			earlyPaymentDiscountDeadline: nextEarlyPaymentDiscountDeadline
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
		if (data.altRate !== undefined) updateData.sourceRateToVes = data.altRate ?? null;
		if (data.sourceCurrency !== undefined) updateData.sourceCurrency = data.sourceCurrency;
		if (
			data.paymentTerms !== undefined ||
			data.creditDueDate !== undefined ||
			data.earlyPaymentDiscountPercent !== undefined ||
			data.earlyPaymentDiscountDeadline !== undefined
		) {
			Object.assign(
				updateData,
				normalizeCreditTermsForWrite({
					paymentTerms: nextPaymentTerms,
					creditDueDate: nextCreditDueDate,
					earlyPaymentDiscountPercent: nextEarlyPaymentDiscountPercent,
					earlyPaymentDiscountDeadline: nextEarlyPaymentDiscountDeadline
				})
			);
		}
		if (data.notes !== undefined) updateData.notes = data.notes ?? null;
		if (data.discount !== undefined) {
			updateData.settlementDiscountType = data.discount.type;
			updateData.settlementDiscountValue = data.discount.value;
			updateData.settlementDiscountNotes = data.discount.notes ?? null;
		}
		updateData.isReadyForReview = false;

		const updated = await db.transaction(async (tx) =>
			updatePurchaseOrder(data.id, updateData, tx)
		);

		await auditService.logUpdate('purchase_order', data.id, existing, updated, context);

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
		unitPurchasePriceAlt: item.unitPurchasePriceAlt ?? null,
		unitSalePrice: item.unitSalePrice,
		isZeroPriceIntentional: item.isZeroPriceIntentional,
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
	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: id,
		paymentTerms: po.paymentTerms as PurchasePaymentTerms,
		creditDueDate: po.creditDueDate,
		earlyPaymentDiscountPercent: po.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: po.earlyPaymentDiscountDeadline
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
		creditDueDate: data.creditDueDate,
		earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
	});
	if (financeIssues.length > 0) {
		return {
			success: false as const,
			error: `Completa la condición de pago antes de guardar: ${financeIssues.join(', ')}`
		};
	}

	try {
		const result = await db.transaction(async (tx) => {
			const creditTerms = normalizeCreditTermsForWrite({
				paymentTerms: data.paymentTerms,
				creditDueDate: data.creditDueDate,
				earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
			});

			const sourceCurrency = data.sourceCurrency ?? 'USD';
			const settlementCurrency =
				data.settlementCurrency ??
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
				'USD_BCV';

			const updated = await updatePurchaseOrder(
				data.id,
				{
					supplierId: data.supplierId,
					documentType: data.documentType,
					invoiceNumber: data.invoiceNumber ?? null,
					deliveryNoteNumber: data.deliveryNoteNumber ?? null,
					orderDate: data.orderDate,
					bcvRate: data.bcvRate,
					sourceRateToVes: data.altRate ?? null,
					sourceCurrency: data.sourceCurrency,
					settlementCurrency,
					...creditTerms,
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

			// Compute and persist settlement amounts from items
			const isNativeSettlement = settlementCurrency !== 'USD_BCV';
			const gross = items.reduce(
				(sum, item) =>
					sum +
					(isNativeSettlement
						? Number(item.unitPurchasePriceAlt ?? item.unitPurchasePrice ?? 0)
						: Number(item.unitPurchasePrice || 0)) *
						Number(item.quantity || 0),
				0
			);
			const usdBcvGross = items.reduce(
				(sum, item) => sum + Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0),
				0
			);
			const discountType = data.discount?.type;
			const discountValue = Number(data.discount?.value ?? 0);
			let settlementDebtAmount = gross;
			let discountFactor = 1;
			if (discountType === 'PERCENT' && discountValue > 0) {
				discountFactor = 1 - Math.min(discountValue, 100) / 100;
				settlementDebtAmount = gross * discountFactor;
			} else if (discountType === 'AMOUNT' && discountValue > 0) {
				settlementDebtAmount = Math.max(0, gross - discountValue);
				discountFactor = gross > 0 ? settlementDebtAmount / gross : 0;
			}
			const settlementUpdate = {
				settlementGrossAmount: data.settlementGrossAmount ?? gross,
				settlementDebtAmount: data.settlementDebtAmount ?? settlementDebtAmount,
				settlementDebtAmountUsdBcvAtOrder: isNativeSettlement
					? Math.round(usdBcvGross * discountFactor * 100) / 100
					: settlementDebtAmount
			};
			if (
				settlementUpdate.settlementGrossAmount !== 0 ||
				settlementUpdate.settlementDebtAmount !== 0
			) {
				await updatePurchaseOrder(data.id, settlementUpdate, tx);
			}

			return { purchaseOrder: { ...updated, ...settlementUpdate }, items };
		});

		await auditService.logUpdate(
			'purchase_order',
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
		await auditService.logUpdate('purchase_order', data.id, existing, updated, context);
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
			setPurchaseOrderReadyForReview(data.id, false, tx, true)
		);
		await auditService.logUpdate('purchase_order', data.id, existing, updated, context);
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
			await auditService.logUpdate('purchase_order_item', data.id, item, updated, context);
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
			'purchase_order',
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
			'purchase_order',
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

		const currencyCode = currencyForPurchasePaymentMethod(data.paymentMethod);

		const normalized = normalizePurchasePaymentAmounts({
			currencyCode,
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

				// Compute native debt amortization
				const amountAppliedToDebt =
					data.amountAppliedToDebt ??
					// Default: assume currency = settlementCurrency (USD_BCV legacy orders)
					normalized.amountUsdBcv;
				const settlementDebtAmount = Number(purchaseOrder.settlementDebtAmount ?? 0);
				const settlementDebtAmountUsdBcvAtOrder = Number(
					purchaseOrder.settlementDebtAmountUsdBcvAtOrder ?? 0
				);
				const amountAppliedToDebtUsdBcvAtOrder =
					settlementDebtAmount > 0
						? Math.round(
								(amountAppliedToDebt / settlementDebtAmount) *
									settlementDebtAmountUsdBcvAtOrder *
									100
							) / 100
						: amountAppliedToDebt; // fallback: same value when denominator is 0

				const payment = await createPurchaseOrderPayment(
					{
						purchaseOrderId: data.purchaseOrderId,
						paymentNumber,
						paymentMethod: data.paymentMethod,
						currencyCode,
						paymentDate: data.paymentDate,
						amount: data.amount,
						bcvUsdRate: data.bcvUsdRate,
						specificRate: data.specificRate ?? null,
						rateType: data.rateType ?? null,
						amountBs: normalized.amountBs,
						amountUsdBcv: normalized.amountUsdBcv,
						amountAppliedToDebt,
						amountAppliedToDebtUsdBcvAtOrder,
						reference: data.reference ?? null,
						notes: data.notes ?? null,
						createdById: context.userId!
					},
					tx
				);
				const benefit = data.earlyPaymentBenefit
					? await createPurchaseOrderEarlyPaymentBenefit(
							{
								purchaseOrderId: data.purchaseOrderId,
								paymentId: payment.id,
								benefitDate: data.paymentDate,
								amountUsdBcv: data.earlyPaymentBenefit.amountUsdBcv,
								amountAppliedToDebt:
									data.earlyPaymentBenefit.amountAppliedToDebt ??
									data.earlyPaymentBenefit.amountUsdBcv,
								amountAppliedToDebtUsdBcvAtOrder:
									data.earlyPaymentBenefit.amountAppliedToDebtUsdBcvAtOrder ??
									data.earlyPaymentBenefit.amountUsdBcv,
								appliedToBalance: data.earlyPaymentBenefit.appliedToBalance,
								note: data.earlyPaymentBenefit.note ?? null,
								createdById: context.userId!
							},
							tx
						)
					: null;

				const [items, payments, earlyPaymentBenefits] = await Promise.all([
					getPurchaseOrderItems(data.purchaseOrderId, tx),
					getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
					getPurchaseOrderEarlyPaymentBenefits(data.purchaseOrderId, { includeVoided: true }, tx)
				]);

				const balance = computePurchaseOrderBalance(
					purchaseOrder,
					items,
					payments,
					earlyPaymentBenefits,
					{
						settlementCurrency: purchaseOrder.settlementCurrency,
						settlementGrossAmount: purchaseOrder.settlementGrossAmount,
						settlementDebtAmount: purchaseOrder.settlementDebtAmount
					}
				);
				const dueStatus = getPurchaseOrderDueStatus({
					paymentTerms: purchaseOrder.paymentTerms,
					creditDueDate: purchaseOrder.creditDueDate,
					earlyPaymentDiscountDeadline: purchaseOrder.earlyPaymentDiscountDeadline,
					balance: balance.settlementBalance
				});

				return { payment, benefit, earlyPaymentBenefits, balance, dueStatus };
			});

			await auditService.logCreate('purchase_order_payment', result.payment, context, {
				excludeFields: ['createdAt', 'updatedAt']
			});
			if (result.benefit) {
				await auditService.logCreate(
					'purchase_order_early_payment_benefit',
					result.benefit,
					context,
					{
						excludeFields: ['createdAt', 'updatedAt']
					}
				);
			}

			const payments = await getPurchaseOrderPaymentsWithUsers(data.purchaseOrderId, {
				includeVoided: true
			});

			return {
				success: true as const,
				payments,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			};
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
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado' };
	}
	const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
	if (!purchaseOrder) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}

	const payment = await findPurchaseOrderPaymentById(data.id);
	if (!payment || payment.purchaseOrderId !== data.purchaseOrderId) {
		return { success: false as const, error: 'Pago no encontrado' };
	}

	try {
		const userId = context.userId;
		const result = await db.transaction(async (tx) => {
			const voided = await voidPurchaseOrderPayment(data.id, userId, tx);
			if (!voided) {
				throw new Error('No se pudo anular el pago');
			}
			await voidPurchaseOrderEarlyPaymentBenefitsByPayment(data.id, userId, tx);

			const [items, payments, earlyPaymentBenefits] = await Promise.all([
				getPurchaseOrderItems(data.purchaseOrderId, tx),
				getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
				getPurchaseOrderEarlyPaymentBenefits(data.purchaseOrderId, { includeVoided: true }, tx)
			]);

			const balance = computePurchaseOrderBalance(
				purchaseOrder,
				items,
				payments,
				earlyPaymentBenefits,
				{
					settlementCurrency: purchaseOrder.settlementCurrency,
					settlementGrossAmount: purchaseOrder.settlementGrossAmount,
					settlementDebtAmount: purchaseOrder.settlementDebtAmount
				}
			);
			const dueStatus = getPurchaseOrderDueStatus({
				paymentTerms: purchaseOrder.paymentTerms,
				creditDueDate: purchaseOrder.creditDueDate,
				earlyPaymentDiscountDeadline: purchaseOrder.earlyPaymentDiscountDeadline,
				balance: balance.settlementBalance
			});

			return { voided, earlyPaymentBenefits, balance, dueStatus };
		});

		await auditService.logUpdate(
			'purchase_order_payment',
			data.id,
			payment,
			result.voided,
			context,
			{ excludeFields: ['createdAt', 'updatedAt'] }
		);

		const payments = await getPurchaseOrderPaymentsWithUsers(data.purchaseOrderId, {
			includeVoided: true
		});

		return {
			success: true as const,
			voided: result.voided,
			payments,
			earlyPaymentBenefits: result.earlyPaymentBenefits,
			balance: result.balance,
			dueStatus: result.dueStatus
		};
	} catch (e) {
		console.error('Error voiding purchase order payment:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Error anulando pago'
		};
	}
});

export const setPurchaseOrderCreditTermsCmd = command(
	SetPurchaseOrderCreditTermsSchema,
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

		try {
			const result = await db.transaction(async (tx) => {
				const creditTerms = normalizeCreditTermsForWrite({
					paymentTerms: data.paymentTerms,
					creditDueDate: data.creditDueDate,
					earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
					earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
				});
				const updatedPurchaseOrder = await updatePurchaseOrder(
					data.purchaseOrderId,
					creditTerms,
					tx
				);

				const [items, payments, earlyPaymentBenefits] = await Promise.all([
					getPurchaseOrderItems(data.purchaseOrderId, tx),
					getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
					getPurchaseOrderEarlyPaymentBenefits(data.purchaseOrderId, { includeVoided: true }, tx)
				]);

				const balance = computePurchaseOrderBalance(
					updatedPurchaseOrder,
					items,
					payments,
					earlyPaymentBenefits,
					{
						settlementCurrency: updatedPurchaseOrder.settlementCurrency,
						settlementGrossAmount: updatedPurchaseOrder.settlementGrossAmount,
						settlementDebtAmount: updatedPurchaseOrder.settlementDebtAmount
					}
				);
				const dueStatus = getPurchaseOrderDueStatus({
					paymentTerms: updatedPurchaseOrder.paymentTerms,
					creditDueDate: updatedPurchaseOrder.creditDueDate,
					earlyPaymentDiscountDeadline: updatedPurchaseOrder.earlyPaymentDiscountDeadline,
					balance: balance.settlementBalance
				});

				return { updatedPurchaseOrder, earlyPaymentBenefits, balance, dueStatus };
			});

			await auditService.logCustom(
				'purchase_order',
				data.purchaseOrderId,
				'update',
				{
					paymentTerms: {
						old: purchaseOrder.paymentTerms,
						new: result.updatedPurchaseOrder.paymentTerms
					},
					creditDueDate: {
						old: purchaseOrder.creditDueDate,
						new: result.updatedPurchaseOrder.creditDueDate
					},
					earlyPaymentDiscountPercent: {
						old: purchaseOrder.earlyPaymentDiscountPercent,
						new: result.updatedPurchaseOrder.earlyPaymentDiscountPercent
					},
					earlyPaymentDiscountDeadline: {
						old: purchaseOrder.earlyPaymentDiscountDeadline,
						new: result.updatedPurchaseOrder.earlyPaymentDiscountDeadline
					}
				},
				context
			);

			return {
				success: true as const,
				purchaseOrder: result.updatedPurchaseOrder,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			};
		} catch (e) {
			console.error('Error setting purchase order credit terms:', e);
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
