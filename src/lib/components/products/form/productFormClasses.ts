import type { RemoteFormIssue } from '@sveltejs/kit';
import { getFormErrorMessage } from '$lib/utils';
import { ProductGender, PRODUCT_GENDER_LABELS } from '$lib/utils/sku';

export const sectionClass = 'glass-card bg-surface-container-lowest p-6';
export const noteCardClass = 'rounded-xl bg-surface-container-low p-4';
export const statCardClass = 'rounded-xl bg-surface-container-low px-4 py-3';
export const fieldLabelClass =
	'block text-[10px] font-bold tracking-[0.18em] text-outline uppercase';
export const baseFieldClass =
	'w-full rounded-lg border border-transparent bg-surface-container-low px-4 py-3 text-sm text-brand-navy placeholder:text-outline-variant transition focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15';
export const errorFieldClass =
	'w-full rounded-lg border border-red-300 bg-surface-container-low px-4 py-3 text-sm text-brand-navy placeholder:text-outline-variant transition focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200';
export const helperTextClass = 'mt-1 text-xs text-on-surface-variant';
export const errorTextClass = 'mt-1 text-xs font-medium text-red-600';
export const genderOptions = Object.entries(PRODUCT_GENDER_LABELS) as Array<
	[ProductGender, string]
>;

export function getIssueText(error: RemoteFormIssue[] | string | null | undefined): string | null {
	return getFormErrorMessage(error);
}

export function getFieldClass(error: string | null, extraClass = ''): string {
	return `${error ? errorFieldClass : baseFieldClass}${extraClass ? ` ${extraClass}` : ''}`;
}
