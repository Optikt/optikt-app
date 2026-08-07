import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export function buildTokenSearchConditions(search: string, concatFields: SQL): SQL[] {
	const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return [];
	return tokens.map((token) => sql`lower(${concatFields}) like ${'%' + token + '%'}`);
}

export function relevanceScoreOrderSql(query: string, fields: SQLWrapper[]): SQL {
	const tokens = query.trim().split(/\s+/).filter(Boolean);

	let denominator: SQL | undefined;
	for (const field of fields) {
		const check = sql`(CASE WHEN coalesce(${field}, '') != '' THEN 1 ELSE 0 END)`;
		denominator = denominator ? sql`${denominator} + ${check}` : check;
	}

	return sql`(
		${tokens.length}::float
		/ nullif(${denominator ?? sql`0`}, 0)
	) DESC`;
}
