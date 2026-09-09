import {
	createEmptyOpticalRangeEntry,
	createEmptyOpticalRangeValidation,
	toContinuousSphereValues,
	toInverseDuplicateSphereValues,
	SPHERE_RANGE_MODE
} from '$lib/utils/opticalRangeForm';
import { toastUnboundErrors } from '$lib/utils';
import type { RemoteFormIssue } from '@sveltejs/kit';
import type {
	OpticalRangeFormEntry,
	OpticalRangeValidation
} from '$lib/utils/opticalRangeForm';

const rangeInputBaseClass =
	'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue font-mono';

export type RangeValidationGroup = 'sphere' | 'cylinder' | 'addition';

export function getRangeInputClass(hasError: boolean, extraClass = ''): string {
	return `${rangeInputBaseClass} ${
		hasError
			? 'border border-error/40 ring-1 ring-error/15 focus:border-error focus:ring-error/20'
			: 'border-0'
	} ${extraClass}`.trim();
}

export function pushUniqueValidationMessage(errors: string[], message: string) {
	if (!errors.includes(message)) {
		errors.push(message);
	}
}

export function mergeRangeValidation(
	clientValidation: OpticalRangeValidation,
	serverValidation?: OpticalRangeValidation
): OpticalRangeValidation {
	const merged = createEmptyOpticalRangeValidation();

	for (const group of ['sphere', 'cylinder', 'addition'] as const) {
		for (const message of clientValidation[group]) {
			pushUniqueValidationMessage(merged[group], message);
		}

		for (const message of serverValidation?.[group] ?? []) {
			pushUniqueValidationMessage(merged[group], message);
		}
	}

	return merged;
}

export function getRangeIssueLocation(
	issue: RemoteFormIssue
): { index?: number; field?: string } | null {
	if (Array.isArray(issue.path) && issue.path[0] === 'ranges') {
		return {
			index: typeof issue.path[1] === 'number' ? issue.path[1] : undefined,
			field:
				typeof issue.path[2] === 'string'
					? issue.path[2]
					: typeof issue.path[1] === 'string'
						? issue.path[1]
						: undefined
		};
	}

	return null;
}

export function getRangeValidationGroup(field?: string): RangeValidationGroup | null {
	if (!field) return null;
	if (field.startsWith('sphere')) return 'sphere';
	if (field.startsWith('cylinder')) return 'cylinder';
	if (field.startsWith('addition')) return 'addition';
	return null;
}

export function buildServerRangeValidations(issues: RemoteFormIssue[]): OpticalRangeValidation[] {
	const validations: OpticalRangeValidation[] = [];

	for (const issue of issues) {
		const location = getRangeIssueLocation(issue);
		if (!location || location.index === undefined) continue;

		const group = getRangeValidationGroup(location.field);
		if (!group) continue;

		const validation = validations[location.index] ?? createEmptyOpticalRangeValidation();
		pushUniqueValidationMessage(validation[group], issue.message);
		validations[location.index] = validation;
	}

	return validations;
}

export function getRootRangeIssues(issues: RemoteFormIssue[]): RemoteFormIssue[] {
	return issues.filter((issue) => {
		const loc = getRangeIssueLocation(issue);
		return !loc || loc.index === undefined;
	});
}

export function isRenderedRangeIssue(issue: RemoteFormIssue): boolean {
	const loc = getRangeIssueLocation(issue);
	if (!loc || loc.index === undefined) return false;
	return getRangeValidationGroup(loc.field) !== null;
}

export function toastUnboundNonRangeIssues(allIssues: RemoteFormIssue[]) {
	const unbound = allIssues.filter((issue) => !isRenderedRangeIssue(issue));
	if (unbound.length > 0) {
		toastUnboundErrors(unbound);
	}
}

export function addRange(ranges: OpticalRangeFormEntry[]): OpticalRangeFormEntry[] {
	return [...ranges, createEmptyOpticalRangeEntry()];
}

export function removeRange(ranges: OpticalRangeFormEntry[], index: number): OpticalRangeFormEntry[] {
	return ranges.filter((_, i) => i !== index);
}

export function toggleSphereMode(range: OpticalRangeFormEntry): void {
	if (range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE) {
		range.sphereMode = SPHERE_RANGE_MODE.CONTINUOUS;
		const continuousValues = toContinuousSphereValues(range.inverseOuter);
		range.sphereMin = continuousValues.sphereMin;
		range.sphereMax = continuousValues.sphereMax;
		return;
	}

	range.sphereMode = SPHERE_RANGE_MODE.INVERSE_DUPLICATE;
	const inverseValues = toInverseDuplicateSphereValues(range.sphereMin, range.sphereMax);
	range.inverseOuter = inverseValues.inverseOuter;
	range.inverseInner = inverseValues.inverseInner;
}
