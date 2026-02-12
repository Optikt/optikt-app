/**
 * Search validation schema
 */
import * as v from 'valibot';

export const UniversalSearchSchema = v.object({
	query: v.pipe(v.string(), v.minLength(1, 'Búsqueda requerida'))
});
