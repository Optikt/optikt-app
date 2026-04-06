/**
 * Reports Remote Functions
 * Server-side functions for report data
 */
import { query } from '$app/server';
import { DateRangeSchema } from '$lib/schemas/reports';
import { getReportSales, getReportPayments, getInventoryReport } from '$lib/server/db/queries';
import type {
	ReportSale,
	SalesReportSummary,
	ReportPayment,
	RefundEntry,
	PaymentsReportSummary,
	InventoryLensItem
} from '$lib/server/db/queries/reports';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesReportResult {
	sales: ReportSale[];
	summary: SalesReportSummary;
}

export interface PaymentsReportResult {
	payments: ReportPayment[];
	refunds: RefundEntry[];
	summary: PaymentsReportSummary;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetch sales report for a date range
 */
export const fetchSalesReport = query(DateRangeSchema, async (data): Promise<SalesReportResult> => {
	const dateFrom = new Date(data.dateFrom);
	const dateTo = new Date(data.dateTo);
	return await getReportSales(dateFrom, dateTo);
});

/**
 * Fetch payments report for a date range
 */
export const fetchPaymentsReport = query(
	DateRangeSchema,
	async (data): Promise<PaymentsReportResult> => {
		const dateFrom = new Date(data.dateFrom);
		const dateTo = new Date(data.dateTo);
		return await getReportPayments(dateFrom, dateTo);
	}
);

/**
 * Fetch lens inventory report (no date filter needed)
 */
export const fetchInventoryReport = query(z.object({}), async (): Promise<InventoryLensItem[]> => {
	return await getInventoryReport();
});
