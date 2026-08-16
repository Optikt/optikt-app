/**
 * Catalog search validation schema
 */
import { z } from 'zod';

export const CatalogSearchSchema = z.object({
	/** Free-text query (token search). Optional — without it, only supplierId filters apply. */
	q: z.string().trim().max(80).optional(),
	/** Restrict results to a single supplier (purchase wizard) */
	supplierId: z.string().uuid().optional(),
	/** Max results per type (products / lens items) */
	limit: z.number().int().min(1).max(50).default(20)
});

export const CatalogItemsByIdsSchema = z
	.object({
		productIds: z.array(z.string().uuid()).max(50).optional(),
		lensIds: z.array(z.string().uuid()).max(50).optional()
	})
	.refine((data) => (data.productIds?.length ?? 0) > 0 || (data.lensIds?.length ?? 0) > 0, {
		message: 'Debe solicitar al menos un producto o un lente'
	});

export type CatalogSearchInput = z.infer<typeof CatalogSearchSchema>;
export type CatalogItemsByIdsInput = z.infer<typeof CatalogItemsByIdsSchema>;
