import { describe, expect, it } from 'vitest';
import type { RemoteFormIssue } from '@sveltejs/kit';
import {
	createEmptyOpticalRangeEntry,
	createEmptyOpticalRangeValidation,
	SPHERE_RANGE_MODE
} from '$lib/utils/opticalRangeForm';
import {
	addRange,
	buildServerRangeValidations,
	getRangeInputClass,
	getRangeIssueLocation,
	getRangeValidationGroup,
	getRootRangeIssues,
	isRenderedRangeIssue,
	mergeRangeValidation,
	pushUniqueValidationMessage,
	removeRange,
	toggleSphereMode
} from './lensFormRanges';

function issue(path: unknown, message = 'Inválido'): RemoteFormIssue {
	return { path, message } as unknown as RemoteFormIssue;
}

describe('getRangeInputClass', () => {
	it('marks error and clean states', () => {
		expect(getRangeInputClass(true)).toContain('border-error');
		expect(getRangeInputClass(false)).toContain('border-0');
		expect(getRangeInputClass(false, 'extra')).toContain('extra');
	});
});

describe('pushUniqueValidationMessage', () => {
	it('dedupes messages', () => {
		const errors: string[] = ['a'];
		pushUniqueValidationMessage(errors, 'a');
		pushUniqueValidationMessage(errors, 'b');

		expect(errors).toEqual(['a', 'b']);
	});
});

describe('mergeRangeValidation', () => {
	it('unions client and server messages without duplicates', () => {
		const client = createEmptyOpticalRangeValidation();
		client.sphere.push('c1');
		const server = createEmptyOpticalRangeValidation();
		server.sphere.push('c1');
		server.sphere.push('s1');

		const merged = mergeRangeValidation(client, server);

		expect(merged.sphere).toEqual(['c1', 's1']);
		expect(merged.cylinder).toEqual([]);
	});
});

describe('range issue routing', () => {
	it('locates range issues by path', () => {
		expect(getRangeIssueLocation(issue(['ranges', 2, 'sphereMin']))).toEqual({
			index: 2,
			field: 'sphereMin'
		});
		expect(getRangeIssueLocation(issue(['name']))).toBeNull();
	});

	it('groups fields by range section', () => {
		expect(getRangeValidationGroup('sphereMin')).toBe('sphere');
		expect(getRangeValidationGroup('cylinderMax')).toBe('cylinder');
		expect(getRangeValidationGroup('additionMin')).toBe('addition');
		expect(getRangeValidationGroup('name')).toBeNull();
		expect(getRangeValidationGroup()).toBeNull();
	});

	it('builds per-index server validations', () => {
		const validations = buildServerRangeValidations([
			issue(['ranges', 0, 'sphereMin'], 'Esfera requerida'),
			issue(['ranges', 1, 'cylinderMax'], 'Cilindro inválido'),
			issue(['name'], 'Nombre requerido')
		]);

		expect(validations[0].sphere).toEqual(['Esfera requerida']);
		expect(validations[1].cylinder).toEqual(['Cilindro inválido']);
		expect(validations.length).toBe(2);
	});

	it('separates root issues from rendered range issues', () => {
		const all = [issue(['ranges', 0, 'sphereMin']), issue(['name'])];

		expect(getRootRangeIssues(all).length).toBe(1);
		expect(isRenderedRangeIssue(all[0])).toBe(true);
		expect(isRenderedRangeIssue(all[1])).toBe(false);
		expect(isRenderedRangeIssue(issue(['ranges', 0, 'unknownField']))).toBe(false);
	});
});

describe('range list helpers', () => {
	it('adds and removes entries immutably', () => {
		const one = addRange([]);

		expect(one.length).toBe(1);
		expect(removeRange([...one, ...one], 0).length).toBe(1);
		expect(removeRange(one, 5).length).toBe(1);
	});

	it('toggles sphere mode both ways', () => {
		const entry = createEmptyOpticalRangeEntry();
		entry.sphereMin = '-2.00';
		entry.sphereMax = '2.00';

		toggleSphereMode(entry);
		expect(entry.sphereMode).toBe(SPHERE_RANGE_MODE.INVERSE_DUPLICATE);

		toggleSphereMode(entry);
		expect(entry.sphereMode).toBe(SPHERE_RANGE_MODE.CONTINUOUS);
		expect(entry.sphereMin).toBe('-2.00');
		expect(entry.sphereMax).toBe('2.00');
	});
});
