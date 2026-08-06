import { sql, type SQL } from 'drizzle-orm';

export function buildTokenSearchConditions(search: string, concatFields: SQL): SQL[] {
	const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return [];
	return tokens.map((token) => sql`lower(${concatFields}) like ${'%' + token + '%'}`);
}
