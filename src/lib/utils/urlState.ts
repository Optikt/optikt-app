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

function referrerKey(basePath: string): string {
	return `listReferrer:${basePath}`;
}

export function saveReferrerParams(basePath: string): void {
	if (typeof window === 'undefined') return;
	sessionStorage.setItem(referrerKey(basePath), window.location.search);
}

export function peekBackUrl(basePath: string): string {
	if (typeof window === 'undefined') return basePath;
	const saved = sessionStorage.getItem(referrerKey(basePath));
	if (!saved) return basePath;
	return `${basePath}${saved}`;
}

export function getBackUrl(basePath: string): string {
	if (typeof window === 'undefined') return basePath;
	const url = peekBackUrl(basePath);
	if (url !== basePath) sessionStorage.removeItem(referrerKey(basePath));
	return url;
}
