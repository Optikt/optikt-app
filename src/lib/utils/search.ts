export function matchesAllTokens(query: string, searchableText: string): boolean {
	const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return false;
	const text = searchableText.toLowerCase();
	return tokens.every((token) => text.includes(token));
}
