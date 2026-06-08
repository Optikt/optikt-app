export function parsePageParam(value: string | null, fallback = 1): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 1) return fallback;
	return parsed;
}

export function parseBooleanParam(value: string | null): boolean {
	return value === '1' || value === 'true';
}

export function setQueryParam(
	params: URLSearchParams,
	key: string,
	value: string | number | null | undefined
): void {
	if (value === undefined || value === null || value === '') {
		params.delete(key);
		return;
	}

	params.set(key, String(value));
}

export function replaceUrlSearch(url: URL, updater: (params: URLSearchParams) => void): void {
	const nextUrl = new URL(url);
	updater(nextUrl.searchParams);
	history.replaceState(history.state, '', nextUrl);
}
