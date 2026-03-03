/**
 * Search validation schema
 */
import { z } from 'zod';

export const UniversalSearchSchema = z.object({
	query: z.string().min(1, 'Búsqueda requerida')
});
