export function matchesAllTokens(query: string, searchableText: string): boolean {
	const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return false;
	const text = searchableText.toLowerCase();
	return tokens.every((token) => text.includes(token));
}

export function computeRelevanceScore(query: string, fields: string[]): number {
	const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (queryTokens.length === 0 || fields.length === 0) return 0;
	return queryTokens.length / fields.length;
}
