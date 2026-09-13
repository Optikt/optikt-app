import type { RemoteFormIssue } from '@sveltejs/kit';
import type {
	PrescriptionFieldIssues,
	PrescriptionFormData,
	PrescriptionFormFieldName
} from '../prescription-form';

export function fieldName(
	data: PrescriptionFormData,
	namePrefix: string,
	field: PrescriptionFormFieldName,
	options?: { omitWhenEmpty?: boolean }
): string | undefined {
	if (options?.omitWhenEmpty && data[field] === '') {
		return undefined;
	}

	return namePrefix ? `${namePrefix}.${field}` : field;
}

export function getIssues(
	issues: PrescriptionFieldIssues | undefined,
	field: PrescriptionFormFieldName
): RemoteFormIssue[] | undefined {
	return issues?.[field]?.issues?.();
}

export function hasFieldError(
	issues: PrescriptionFieldIssues | undefined,
	field: PrescriptionFormFieldName
): boolean {
	return (getIssues(issues, field)?.length ?? 0) > 0;
}

export function treatmentCardClass(selected: boolean): string {
	return selected
		? 'border-brand-blue/30 bg-brand-blue/10 text-brand-navy shadow-[var(--ds-shadow-sm)]'
		: 'border-outline-variant/15 bg-surface text-on-surface';
}
