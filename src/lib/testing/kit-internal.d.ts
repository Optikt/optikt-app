declare module '@sveltejs/kit/internal/server' {
	export function with_request_store<T>(
		store: { event: unknown; state: unknown } | null,
		fn: () => T
	): T;
}
