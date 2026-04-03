/**
 * Report validation schemas
 */
import { z } from 'zod';

export const DateRangeSchema = z.object({
	dateFrom: z.string().min(1, 'Fecha inicio requerida'),
	dateTo: z.string().min(1, 'Fecha fin requerida')
});
