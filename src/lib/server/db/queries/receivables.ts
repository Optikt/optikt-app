import { eq, isNull, and, desc, sql, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sales, salePayments, customers } from '$lib/server/db/schema';
import type { SalePayment } from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface ReceivableRow {
	saleId: string;
	saleNumber: string;
	status: string;
	createdAt: string;
	customerId: string | null;
	customerName: string | null;
	customerPhone: string | null;
	customerIdNumber: string | null;
	totalAmount: number;
	isCashea: boolean;
	totalPaid: number;
	balance: number;
	daysPending: number;
	payments: ReceivablePayment[];
}

export interface ReceivablePayment {
	id: string;
	method: string;
	amount: number;
	amountBcvUsd: number;
	date: string;
	reference: string | null;
}

export interface ReceivablesSummary {
	totalBalance: number;
	totalCount: number;
	avgDaysPending: number;
}

export interface ReceivablesFilters {
	customerId?: string;
}

// ============================================================================
// QUERY
// ============================================================================

/**
 * Get all receivables (non-cancelled sales with outstanding balance > 0).
 *
 * Returns each sale with customer info, status, balance, days pending, and payment history.
 * Ordered by balance DESC (largest debt first).
 */
export async function getReceivables(
	filters?: ReceivablesFilters
): Promise<{ rows: ReceivableRow[]; summary: ReceivablesSummary }> {
	const conditions = [
		isNull(sales.deletedAt),
		sql`${sales.status} != 'CANCELLED'`,
		gt(sql<number>`${sales.total} - ${sales.paidAmountBcvUsd}`, 0)
	];

	if (filters?.customerId) {
		conditions.push(eq(sales.customerId, filters.customerId));
	}

	// Fetch receivable sales with customer info
	const rows = await db
		.select({
			saleId: sales.id,
			orderNumber: sales.orderNumber,
			status: sales.status,
			createdAt: sales.createdAt,
			totalAmount: sales.total,
			paidAmountBcvUsd: sales.paidAmountBcvUsd,
			isCashea: sales.isCashea,
			customerId: customers.id,
			customerFirstName: customers.firstName,
			customerLastName: customers.lastName,
			customerPhone: customers.primaryPhone,
			customerIdNumber: customers.idNumber
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.where(and(...conditions))
		.orderBy(desc(sql`${sales.total} - ${sales.paidAmountBcvUsd}`));

	if (rows.length === 0) {
		return {
			rows: [],
			summary: { totalBalance: 0, totalCount: 0, avgDaysPending: 0 }
		};
	}

	// Fetch payments for all receivable sales in one query
	const saleIds = rows.map((r) => r.saleId);
	const allPayments = await db
		.select()
		.from(salePayments)
		.where(and(sql`${salePayments.saleId} IN ${saleIds}`, isNull(salePayments.voidedAt)))
		.orderBy(desc(salePayments.paymentDate));

	// Group payments by saleId
	const paymentsBySale = new Map<string, SalePayment[]>();
	for (const p of allPayments) {
		const list = paymentsBySale.get(p.saleId) ?? [];
		list.push(p);
		paymentsBySale.set(p.saleId, list);
	}

	const now = Date.now();
	let totalBalance = 0;
	let totalDays = 0;

	const receivables: ReceivableRow[] = rows.map((r) => {
		const balance = r.totalAmount - r.paidAmountBcvUsd;
		const createdMs = new Date(r.createdAt).getTime();
		const daysPending = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));

		totalBalance += balance;
		totalDays += daysPending;

		const salePaymentsList = paymentsBySale.get(r.saleId) ?? [];

		return {
			saleId: r.saleId,
			saleNumber: `#${String(r.orderNumber).padStart(4, '0')}`,
			status: r.status,
			createdAt: r.createdAt,
			customerId: r.customerId,
			customerName: r.customerFirstName ? `${r.customerFirstName} ${r.customerLastName}` : null,
			customerPhone: r.customerPhone,
			customerIdNumber: r.customerIdNumber,
			totalAmount: r.totalAmount,
			totalPaid: r.paidAmountBcvUsd,
			isCashea: r.isCashea,
			balance,
			daysPending,
			payments: salePaymentsList.map((p) => ({
				id: p.id,
				method: p.paymentMethod,
				amount: p.amount,
				amountBcvUsd: p.amountBcvUsd,
				date: p.paymentDate,
				reference: p.reference
			}))
		};
	});

	return {
		rows: receivables,
		summary: {
			totalBalance,
			totalCount: receivables.length,
			avgDaysPending: receivables.length > 0 ? Math.round(totalDays / receivables.length) : 0
		}
	};
}
