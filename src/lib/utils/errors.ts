import { isHttpError } from '@sveltejs/kit';
import { logger } from './logger';

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

	if (typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') {
		return e.message;
	}

	// Fallback for unknown error types
	return fallback;
}

function serializeErrorDetails(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			cause: error.cause
		};
	}

	if (isHttpError(error)) {
		return {
			status: error.status,
			body: error.body,
			message: error.body.message
		};
	}

	if (typeof error === 'object' && error !== null) {
		return { ...error };
	}

	return { value: error };
}

export function reportClientError(
	source: string,
	error: unknown,
	context: Record<string, unknown> = {}
): void {
	logger.error(source, undefined, {
		...context,
		...serializeErrorDetails(error)
	});
}
