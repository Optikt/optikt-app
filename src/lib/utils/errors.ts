import { isHttpError } from '@sveltejs/kit';

/**
 * Error handling utilities for remote functions
 */

/**
 * Error response structure from SvelteKit's error() function
 */
interface HttpError {
	status: number;
	body: {
		message: string;
	};
}

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
