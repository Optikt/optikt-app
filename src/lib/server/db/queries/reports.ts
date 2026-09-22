/**
 * Report-specific database queries
 * Read-only aggregation queries for the reports module.
 *
 * Reuses existing query functions where possible and provides
 * flat projections + aggregation for the reports UI.
 */
import { eq, isNull, and, gte, lte, desc, ne, or, sql, isNotNull, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { salePayments, sales, customers, saleItems, products } from '$lib/server/db/schema';
import { fromISODate, toEndOfDay, toUTCString } from '$lib/dates';
import { getAllSales } from './sales/reads';
import { getLensCatalogItemsWithRelations } from './lenses/catalog';
import { DiscountType, ProductType, RefundStatus } from '$lib/shared/enums';

// ============================================================================
// HELPERS
// ============================================================================

/** Build "First Last" from separate name parts, or null when either is missing. */
function formatCustomerName(
	firstName: string | null | undefined,
	lastName: string | null | undefined
): string | null {
	return firstName && lastName ? `${firstName} ${lastName}` : null;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ReportSale {
	id: string;
	orderNumber: number;
	saleDate: string;
	status: string;
	total: number;
	paidAmountBcvUsd: number;
	customerName: string | null;
	sellerName: string | null;
}

export interface SalesReportSummary {
	count: number;
	totalAmount: number;
	totalPaid: number;
	cancelledCount: number;
	cancelledAmount: number;
}

export interface BrandSalesSlice {
	brand: string;
	total: number;
	salesCount: number;
}

export interface ReportPayment {
	id: string;
	paymentDate: string;
	createdAt: string;
	paymentMethod: string;
	amount: number;
	exchangeRate: number | null;
	bcvRate: number;
	amountBcvUsd: number;
	reference: string | null;
	saleOrderNumber: number;
	saleId: string;
	customerName: string | null;
	/** Present only on payments from cancelled+retained sales */
	isRetained?: boolean;
}

export interface RefundEntry {
	saleId: string;
	saleOrderNumber: number;
	customerName: string | null;
	refundAmount: number;
	refundStatus: string;
	cancelledAt: string | null;
}

export interface PaymentsReportSummary {
	/** Payments from active sales + retained cancellations - the real income */
	grossBcvUsd: number;
	/** Total refunded from cancelled sales (informational, NOT subtracted from gross) */
	refundedBcvUsd: number;
	/** Number of refunded sales in the period */
	refundCount: number;
	/** Total retained from cancelled sales (included in gross) */
	retainedBcvUsd: number;
	countPayments: number;
	byMethod: { method: string; total: number; count: number }[];
}

export interface InventoryLensItem {
	id: string;
	name: string;
	type: string;
	stock: number | null;
	inventoryMode: string;
	pairPurchasePrice: number;
	salePrice: number | null;
	materialName: string | null;
	supplierName: string | null;
}

// ============================================================================
// SALES REPORT
// ============================================================================

/**
 * Get sales within a date range for reporting.
 * Delegates to getAllSales() and flattens the relational result.
 * Includes product sales grouped by brand (snapshot name at sale time).
 */
export async function getReportSales(
	dateFrom: string,
	dateTo: string
): Promise<{ sales: ReportSale[]; summary: SalesReportSummary; byBrand: BrandSalesSlice[] }> {
	const [rows, byBrand] = await Promise.all([
		getAllSales({ dateFrom, dateTo }),
		getReportSalesByBrand(dateFrom, dateTo)
	]);

	const reportSales: ReportSale[] = rows.map((r) => ({
		id: r.id,
		orderNumber: r.orderNumber,
		saleDate: r.saleDate,
		status: r.status,
		total: r.total,
		paidAmountBcvUsd: r.paidAmountBcvUsd ?? 0,
		customerName: formatCustomerName(r.customer?.firstName, r.customer?.lastName),
		sellerName: r.seller?.fullName ?? null
	}));

	const active = reportSales.filter((s) => s.status !== 'CANCELLED');
	const cancelled = reportSales.filter((s) => s.status === 'CANCELLED');

	const summary: SalesReportSummary = {
		count: active.length,
		totalAmount: active.reduce((acc, s) => acc + s.total, 0),
		totalPaid: active.reduce((acc, s) => acc + s.paidAmountBcvUsd, 0),
		cancelledCount: cancelled.length,
		cancelledAmount: cancelled.reduce((acc, s) => acc + s.total, 0)
	};

	return { sales: reportSales, summary, byBrand };
}

const lineNetTotal = sql<number>`greatest(0, ${saleItems.unitPrice} * ${saleItems.quantity} - case when ${saleItems.discountType} = ${DiscountType.PERCENTAGE} then ${saleItems.unitPrice} * ${saleItems.quantity} * ${saleItems.discount} / 100 else ${saleItems.discount} end)`;

/**
 * Product sales within a date range grouped by brand snapshot (top brands by net total).
 * Pre-global-discount: the sale-level global discount is not allocated per line.
 */
export async function getReportSalesByBrand(
	dateFrom: string,
	dateTo: string,
	limit = 8
): Promise<BrandSalesSlice[]> {
	const toEnd = toUTCString(toEndOfDay(fromISODate(dateTo)!));

	const rows = await db
		.select({
			brand: saleItems.snapshotBrand,
			total: sql<number>`coalesce(sum(${lineNetTotal}), 0)`.mapWith(Number),
			salesCount: sql<number>`count(distinct ${sales.id})::int`.mapWith(Number)
		})
		.from(saleItems)
		.innerJoin(sales, eq(saleItems.saleId, sales.id))
		.innerJoin(products, eq(saleItems.productId, products.id))
		.where(
			and(
				eq(saleItems.itemType, 'PRODUCT'),
				inArray(products.type, [ProductType.FRAME, ProductType.SUNGLASSES]),
				isNotNull(saleItems.snapshotBrand),
				isNull(saleItems.deletedAt),
				isNull(sales.deletedAt),
				ne(sales.status, 'CANCELLED'),
				gte(sales.createdAt, dateFrom),
				lte(sales.createdAt, toEnd)
			)
		)
		.groupBy(saleItems.snapshotBrand)
		.orderBy(desc(sql`coalesce(sum(${lineNetTotal}), 0)`))
		.limit(limit);

	return rows.map((r) => ({
		brand: r.brand ?? 'Sin marca',
		total: r.total,
		salesCount: r.salesCount
	}));
}

// ============================================================================
// PAYMENTS REPORT
// ============================================================================

/**
 * Get all non-voided payments within a date range, with sale info.
 * Includes payments from active sales and cancelled+retained sales.
 * Separately tracks refunded amounts.
 */
export async function getReportPayments(
	dateFrom: string,
	dateTo: string
): Promise<{ payments: ReportPayment[]; refunds: RefundEntry[]; summary: PaymentsReportSummary }> {
	const toEnd = toUTCString(toEndOfDay(fromISODate(dateTo)!));

	// Include: active sales + cancelled sales with RETAINED refundStatus
	const rows = await db
		.select({
			id: salePayments.id,
			paymentDate: salePayments.paymentDate,
			createdAt: salePayments.createdAt,
			paymentMethod: salePayments.paymentMethod,
			amount: salePayments.amount,
			exchangeRate: salePayments.exchangeRate,
			bcvRate: salePayments.bcvRate,
			amountBcvUsd: salePayments.amountBcvUsd,
			reference: salePayments.reference,
			saleId: salePayments.saleId,
			saleOrderNumber: sales.orderNumber,
			saleStatus: sales.status,
			saleRefundStatus: sales.refundStatus,
			customerFirstName: customers.firstName,
			customerLastName: customers.lastName
		})
		.from(salePayments)
		.innerJoin(sales, eq(salePayments.saleId, sales.id))
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.where(
			and(
				isNull(salePayments.voidedAt),
				isNull(sales.deletedAt),
				or(ne(sales.status, 'CANCELLED'), eq(sales.refundStatus, RefundStatus.RETAINED)),
				gte(salePayments.paymentDate, dateFrom),
				lte(salePayments.paymentDate, toEnd)
			)
		)
		.orderBy(desc(salePayments.paymentDate), desc(salePayments.createdAt));

	const reportPayments: ReportPayment[] = rows.map((r) => ({
		id: r.id,
		paymentDate: r.paymentDate,
		createdAt: r.createdAt,
		paymentMethod: r.paymentMethod,
		amount: r.amount,
		exchangeRate: r.exchangeRate,
		bcvRate: r.bcvRate,
		amountBcvUsd: r.amountBcvUsd,
		reference: r.reference,
		saleId: r.saleId,
		saleOrderNumber: r.saleOrderNumber,
		customerName: formatCustomerName(r.customerFirstName, r.customerLastName),
		isRetained: r.saleStatus === 'CANCELLED' && r.saleRefundStatus === RefundStatus.RETAINED
	}));

	// Get refunded cancelled sales in the date range
	const refundedRows = await db
		.select({
			saleId: sales.id,
			saleOrderNumber: sales.orderNumber,
			refundAmount: sales.refundAmount,
			refundStatus: sales.refundStatus,
			cancelledAt: sales.cancelledAt,
			customerFirstName: customers.firstName,
			customerLastName: customers.lastName
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.where(
			and(
				isNull(sales.deletedAt),
				eq(sales.status, 'CANCELLED'),
				eq(sales.refundStatus, RefundStatus.REFUNDED),
				gte(sales.cancelledAt, dateFrom),
				lte(sales.cancelledAt, toEnd)
			)
		)
		.orderBy(desc(sales.cancelledAt));

	const refunds: RefundEntry[] = refundedRows.map((r) => ({
		saleId: r.saleId,
		saleOrderNumber: r.saleOrderNumber,
		customerName: formatCustomerName(r.customerFirstName, r.customerLastName),
		refundAmount: r.refundAmount ?? 0,
		refundStatus: r.refundStatus ?? '',
		cancelledAt: r.cancelledAt
	}));

	// Aggregate by payment method
	const methodMap = new Map<string, { total: number; count: number }>();
	for (const p of reportPayments) {
		const entry = methodMap.get(p.paymentMethod) ?? { total: 0, count: 0 };
		entry.total += p.amountBcvUsd;
		entry.count += 1;
		methodMap.set(p.paymentMethod, entry);
	}

	const grossBcvUsd = reportPayments.reduce((acc, p) => acc + p.amountBcvUsd, 0);
	const refundedBcvUsd = refunds.reduce((acc, r) => acc + r.refundAmount, 0);
	const retainedBcvUsd = reportPayments
		.filter((p) => p.isRetained)
		.reduce((acc, p) => acc + p.amountBcvUsd, 0);

	const summary: PaymentsReportSummary = {
		grossBcvUsd,
		refundedBcvUsd,
		refundCount: refunds.length,
		retainedBcvUsd,
		countPayments: reportPayments.length,
		byMethod: Array.from(methodMap.entries()).map(([method, data]) => ({
			method,
			total: data.total,
			count: data.count
		}))
	};

	return { payments: reportPayments, refunds, summary };
}

// ============================================================================
// INVENTORY REPORT (LENSES)
// ============================================================================

/**
 * Get all active lenses with inventory info for reporting.
 * Delegates to getLensCatalogItemsWithRelations() and flattens the result.
 */
export async function getInventoryReport(): Promise<InventoryLensItem[]> {
	const items = await getLensCatalogItemsWithRelations();

	return items.map((item) => ({
		id: item.id,
		name: item.name,
		type: item.type,
		stock: item.stock,
		inventoryMode: item.inventoryMode,
		pairPurchasePrice: item.pairPurchasePrice,
		salePrice: item.salePrice,
		materialName: item.material?.name ?? null,
		supplierName: item.supplier?.name ?? null
	}));
}
