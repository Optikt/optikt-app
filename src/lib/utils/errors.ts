import { isHttpError } from '@sveltejs/kit';

/**
 * Extract error message from various error types
 * Handles:
 * - Standard Error instances
 * - SvelteKit HTTP errors (from error() function)
 * - Unknown error types
 */
export function getErrorMessage(e: unknown, fallback = 'Ha ocurrido un error'): string {
	// Standard Error instance
	if (e instanceof Error) {
		return e.message;
	}

	// SvelteKit HTTP error (from error() function in remote functions)
	if (isHttpError(e)) {
		return e.body.message;
	}

	// Fallback for unknown error types
	return fallback;
}
