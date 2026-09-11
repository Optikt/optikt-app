import { describe, expect, it } from 'vitest';
import {
	buildCustomerEditData,
	findCurrentPrescription,
	getInitials,
	toggleExpandedId
} from './customerDetail';

describe('getInitials', () => {
	it('builds uppercase initials with fallbacks', () => {
		expect(getInitials({ firstName: 'Ana', lastName: 'Pérez' })).toBe('AP');
		expect(getInitials({ firstName: 'Ana' })).toBe('A');
		expect(getInitials({})).toBe('');
	});
});

describe('buildCustomerEditData', () => {
	it('maps nulls to empty strings', () => {
		const result = buildCustomerEditData({
			firstName: 'Ana',
			lastName: null,
			idNumber: 'V-1',
			birthDate: null,
			primaryPhone: null,
			email: 'a@x.com',
			address: null,
			notes: null
		});

		expect(result).toMatchObject({
			firstName: 'Ana',
			lastName: '',
			idNumber: 'V-1',
			birthDate: undefined,
			primaryPhone: '',
			email: 'a@x.com'
		});
	});

	it('parses birth dates to local', () => {
		const result = buildCustomerEditData({ birthDate: '1990-05-01' });

		expect(result.birthDate).toBeInstanceOf(Date);
		expect(result.birthDate?.getFullYear()).toBe(1990);
	});
});

describe('toggleExpandedId', () => {
	it('toggles expansion', () => {
		expect(toggleExpandedId(null, 'a')).toBe('a');
		expect(toggleExpandedId('a', 'a')).toBeNull();
		expect(toggleExpandedId('a', 'b')).toBe('b');
	});
});

describe('findCurrentPrescription', () => {
	it('finds current or null', () => {
		const list = [{ id: '1', isCurrent: false }, { id: '2', isCurrent: true }];
		expect(findCurrentPrescription(list)?.id).toBe('2');
		expect(findCurrentPrescription([{ id: '1' }])).toBeNull();
		expect(findCurrentPrescription([])).toBeNull();
	});
});
