/**
 * Common pagination schemas
 * Split from schemas/common.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { z } from 'zod';

// =============================================================================
// LIST PAGINATION SCHEMAS
// =============================================================================

/**
 * Standard pagination parameters for list endpoints
 */
export const ListPaginationSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional()
});

/**
 * Pagination with soft-delete support
 */
export const ListPaginationWithDeletedSchema = ListPaginationSchema.extend({
	includeDeleted: z.boolean().default(false)
});

/**
 * Pagination with includeInactive flag (for users, products, etc.)
 */
export const ListPaginationWithInactiveSchema = ListPaginationSchema.extend({
	includeInactive: z.boolean().default(false)
});
