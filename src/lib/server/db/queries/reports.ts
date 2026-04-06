/**
 * Report-specific database queries
 * Read-only aggregation queries for the reports module.
 *
 * Reuses existing query functions where possible and provides
 * flat projections + aggregation for the reports UI.
 */
import { eq, isNull, and, gte, lte, desc, ne, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { salePayments, sales, customers } from '$lib/server/db/schema';
import { getAllSales } from './sales';
import { getLensCatalogItemsWithRelations } from './lenses';
import { RefundStatus } from '$lib/shared/enums';

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
	saleDate: Date;
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

export interface ReportPayment {
	id: string;
	paymentDate: Date;
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
	cancelledAt: Date | null;
}

export interface PaymentsReportSummary {
	/** Payments from active sales + retained cancellations */
	grossBcvUsd: number;
	/** Total refunded from cancelled sales */
	refundedBcvUsd: number;
	/** Total retained from cancelled sales (included in gross) */
	retainedBcvUsd: number;
	/** grossBcvUsd - refundedBcvUsd */
	netBcvUsd: number;
	countPayments: number;
	byMethod: { method: string; total: number; count: number }[];
}

export interface InventoryLensItem {
	id: string;
	name: string;
	type: string;
	stock: number | null;
	inventoryMode: string;
	basePrice: number;
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
 */
export async function getReportSales(
	dateFrom: Date,
	dateTo: Date
): Promise<{ sales: ReportSale[]; summary: SalesReportSummary }> {
	const rows = await getAllSales({ dateFrom, dateTo });

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

	return { sales: reportSales, summary };
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
	dateFrom: Date,
	dateTo: Date
): Promise<{ payments: ReportPayment[]; refunds: RefundEntry[]; summary: PaymentsReportSummary }> {
	const toEnd = new Date(dateTo);
	toEnd.setUTCHours(23, 59, 59, 999);

	// Include: active sales + cancelled sales with RETAINED refundStatus
	const rows = await db
		.select({
			id: salePayments.id,
			paymentDate: salePayments.paymentDate,
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
		.orderBy(desc(salePayments.paymentDate));

	const reportPayments: ReportPayment[] = rows.map((r) => ({
		id: r.id,
		paymentDate: r.paymentDate,
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
		retainedBcvUsd,
		netBcvUsd: grossBcvUsd - refundedBcvUsd,
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
		basePrice: item.basePrice,
		salePrice: item.salePrice,
		materialName: item.material?.name ?? null,
		supplierName: item.supplier?.name ?? null
	}));
}
