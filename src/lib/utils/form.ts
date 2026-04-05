/**
 * Form utility functions
 */

import type { RemoteFormIssue } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

/**
 * Scrolls to the first form input with an error.
 * Finds the first element with Flowbite's error border styling and scrolls to it.
 * Useful for long forms where errors may be off-screen after submission.
 */
export function scrollToFirstError(): void {
	// Wait for DOM to update with error styles
	setTimeout(() => {
		// Find first input/textarea with error (Flowbite uses border-red-500 for error inputs)
		const firstError = document.querySelector(
			'.border-red-500, [class*="border-red"]'
		) as HTMLElement | null;

		if (firstError) {
			firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
			firstError.focus();
		}
	}, 50);
}

/**
 * Normalizes form error input to a displayable string.
 * Accepts string, RemoteFormIssue[], or null/undefined.
 * Used in custom inputs to handle multiple error formats.
 */
export function getFormErrorMessage(
	error: RemoteFormIssue[] | string | null | undefined
): string | null {
	if (!error) return null;
	if (typeof error === 'string') return error;
	if (error.length > 0) return error[0].message;
	return null;
}

/**
 * Toasts validation errors that have no visible DOM representation.
 * Checks each issue's field name against the DOM — if no element with that
 * `name` attribute has Flowbite's red border styling, the error is considered
 * "unbound" and gets surfaced as a toast so it's never silently swallowed.
 */
export function toastUnboundErrors(allIssues: RemoteFormIssue[]): void {
	if (allIssues.length === 0) return;

	// Wait for DOM to render error styles (same timing as scrollToFirstError)
	setTimeout(() => {
		for (const issue of allIssues) {
			const fieldName = String(issue.path[0] ?? '');
			if (!fieldName) {
				toast.error(issue.message);
				continue;
			}

			const field = document.querySelector(`[name="${CSS.escape(fieldName)}"]`);
			const hasVisibleError =
				field?.matches('.border-red-500, [class*="border-red"]') ||
				field?.parentElement?.querySelector(
					'.text-red-500, .text-red-600, .text-red-700, .border-red-500'
				) !== null;

			if (!hasVisibleError) {
				toast.error(issue.message);
			}
		}
	}, 100);
}
