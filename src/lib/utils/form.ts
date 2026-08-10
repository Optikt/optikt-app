/**
 * Form utility functions
 */

import type { RemoteFormIssue } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';
import { logger } from './logger';

const ERROR_FIELD_SELECTORS =
	'[aria-invalid="true"], [data-field-error="true"], .border-red-500, [class*="border-red"], [class*="ring-red"]';

const ERROR_MESSAGE_SELECTORS =
	'.form-field-error, .text-error, .text-red-500, .text-red-600, .text-red-700, .border-red-500';

function escapeSelectorValue(value: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(value);
	}

	return value.replace(/["\\]/g, '\\$&');
}

function hasRenderedIssue(fieldName: string): boolean {
	const escapedFieldName = escapeSelectorValue(fieldName);
	const fieldWrapper = document.querySelector(`[data-form-field="${escapedFieldName}"]`);

	if (fieldWrapper) {
		return fieldWrapper.getAttribute('data-field-error') === 'true';
	}

	const field = document.querySelector(`[name="${escapedFieldName}"]`);
	if (!field) {
		return false;
	}

	return (
		field.matches(ERROR_FIELD_SELECTORS) ||
		field.closest('[data-field-error="true"]') !== null ||
		field.parentElement?.querySelector(ERROR_MESSAGE_SELECTORS) !== null
	);
}

export function issuePathToFieldNames(path: ReadonlyArray<string | number>): string[] {
	const segments = path.map((segment) => String(segment)).filter(Boolean);
	if (segments.length === 0) return [];

	const dotNotation = segments.join('.');
	const bracketNotation = segments.reduce((fieldName, segment, index) => {
		if (index === 0) {
			return segment;
		}

		return /^\d+$/.test(segment) ? `${fieldName}[${segment}]` : `${fieldName}.${segment}`;
	}, '');

	return Array.from(new Set([dotNotation, bracketNotation]));
}

/**
 * Scrolls to the first form input with an error.
 * Finds the first field marked as invalid and scrolls it into view.
 * Useful for long forms where errors may be off-screen after submission.
 */
export function scrollToFirstError(): void {
	// Wait for DOM to update with error styles
	setTimeout(() => {
		const firstError = document.querySelector(
			'[aria-invalid="true"], [data-field-error="true"], .border-red-500, [class*="border-red"], [class*="ring-red"], .form-field-error'
		) as HTMLElement | null;

		if (firstError) {
			firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });

			const focusTarget = firstError.matches('input, select, textarea, button')
				? firstError
				: (firstError.querySelector('input, select, textarea, button') as HTMLElement | null);

			focusTarget?.focus();
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
 * Checks each issue's field name against the DOM - if no element with that
 * `name` attribute has red border styling (from FormInput's error state), the error is considered
 * "unbound" and gets surfaced as a toast so it's never silently swallowed.
 */
export function toastUnboundErrors(allIssues: RemoteFormIssue[]): void {
	if (allIssues.length === 0) return;

	// Wait for DOM to render error styles (same timing as scrollToFirstError)
	setTimeout(() => {
		const toastedIssues = new Set<string>();
		const unboundIssues: Array<{
			message: string;
			path: string[];
			fieldNames: string[];
		}> = [];

		for (const issue of allIssues) {
			const fieldNames = issuePathToFieldNames(issue.path);
			const hasVisibleError = fieldNames.some(hasRenderedIssue);
			const toastKey = `${fieldNames[0] ?? '__root__'}:${issue.message}`;

			if (!hasVisibleError && !toastedIssues.has(toastKey)) {
				toastedIssues.add(toastKey);
				unboundIssues.push({
					message: issue.message,
					path: issue.path.map((segment) => String(segment)),
					fieldNames
				});
				toast.error(issue.message);
			}
		}

		if (unboundIssues.length > 0) {
			logger.warn('remote-form.unbound-issues', {
				issues: unboundIssues
			});
		}
	}, 100);
}
