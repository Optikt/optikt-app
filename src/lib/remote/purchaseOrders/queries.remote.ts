/**
 * Purchase orders remote — queries
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { PurchaseOrderDetail } from './helpers';
import { query } from '$app/server';
import { requireAuth } from '#lib/server/guards.js';

import { z } from 'zod';
import {
	ListPurchaseOrdersSchema,
	ConfirmPurchaseOrderSchema
} from '#lib/schemas/purchaseOrders.js';
import { ListPurchaseOrderPaymentsSchema } from '#lib/schemas/purchaseOrderPayments.js';

import { getPurchaseOrderItems } from '#lib/server/db/queries/purchaseOrders/items.js';
import {
	getAllPurchaseOrders,
	countPurchaseOrders,
	getPurchaseOrderListStats as getPurchaseOrderListStatsQuery,
	findPurchaseOrderByIdWithRelations
} from '#lib/server/db/queries/purchaseOrders/orders.js';
import { getPurchaseOrderPayments } from '#lib/server/db/queries/purchaseOrderPayments.js';
import { getUpcomingPurchaseOrderDues } from '#lib/server/db/queries/purchaseOrderCreditSchedule.js';
import { getPurchaseOrderEarlyPaymentBenefits } from '#lib/server/db/queries/purchaseOrderEarlyPaymentBenefits.js';

import type {
	PurchaseOrderListStats,
	PurchaseOrderWithRelations
} from '#lib/server/db/queries/purchaseOrders/types.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';

import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '#lib/shared/purchaseOrderCredit.js';

import type { PaginatedResult } from '#lib/types/index.js';
import type { PurchaseOrderPayment, Supplier } from '#lib/server/db/schema/index.js';

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
