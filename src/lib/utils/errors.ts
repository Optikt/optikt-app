import * as Sentry from '@sentry/sveltekit';
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

function normalizeToError(error: unknown, fallback: string): Error {
	if (error instanceof Error) {
		return error;
	}

	if (isHttpError(error)) {
		return new Error(error.body.message);
	}

	if (typeof error === 'object' && error !== null && 'message' in error) {
		const message = error.message;
		if (typeof message === 'string' && message.trim().length > 0) {
			return new Error(message);
		}
	}

	return new Error(fallback);
}

export function reportClientError(
	source: string,
	error: unknown,
	context: Record<string, unknown> = {}
): void {
	console.error(`[${source}]`, {
		...context,
		...serializeErrorDetails(error)
	});
}

export function captureClientException(
	source: string,
	error: unknown,
	context: Record<string, unknown> = {}
): void {
	reportClientError(source, error, context);

	if (!Sentry.getClient()) {
		return;
	}

	const serializedError = serializeErrorDetails(error);
	const normalizedError = normalizeToError(error, `Client exception reported from ${source}`);

	Sentry.withScope((scope) => {
		scope.setTag('error_source', source);

		if (Object.keys(context).length > 0) {
			scope.setContext('report_context', context);
		}

		scope.setContext('error_details', serializedError);
		Sentry.captureException(normalizedError);
	});
}
