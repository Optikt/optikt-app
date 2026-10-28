/**
 * Receivables Remote Functions
 * Server-side functions for accounts receivable management
 */
import { z } from 'zod';
import { query } from '$app/server';
import { requireRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getReceivables } from '#lib/server/db/queries/receivables.js';
import type { ReceivableRow, ReceivablesSummary } from '#lib/server/db/queries/receivables.js';
import { addPayment } from '#lib/remote/sales/payments.remote.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const GetReceivablesSchema = z.object({
	customerId: z.uuid().optional()
});

// ============================================================================
// TYPES
// ============================================================================

export type { ReceivableRow, ReceivablesSummary } from '#lib/server/db/queries/receivables.js';

export interface ReceivablesData {
	rows: ReceivableRow[];
	summary: ReceivablesSummary;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all receivables (non-cancelled sales with outstanding balance)
 */
export const getReceivablesQuery = query(
	GetReceivablesSchema,
	async (data): Promise<ReceivablesData> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
		return getReceivables(data.customerId ? { customerId: data.customerId } : undefined);
	}
);

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Register a payment against a sale.
 * Reuses the exact same addPayment command from the sales module.
 * The addPayment command already handles:
 * - Validation
 * - Transaction: payment + recalc + auto-complete if fully paid
 * - Audit logging
 */
export const registerPayment = addPayment;
