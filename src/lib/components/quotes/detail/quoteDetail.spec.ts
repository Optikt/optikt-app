import { describe, expect, it } from 'vitest';
import {
	actionButtonClasses,
	canSubmitAssignCustomer,
	coerceNewCustomer,
	quoteCustomerIdNumber,
	quoteCustomerName
} from './quoteDetail';

describe('quote customer display', () => {
	it('names customers with fallback', () => {
		expect(quoteCustomerName({ customer: { firstName: 'Ana', lastName: 'Paz' } })).toBe('Ana Paz');
		expect(quoteCustomerName({ customer: null })).toBe('Sin cliente');
		expect(quoteCustomerIdNumber({ customer: { idNumber: 'V-1' } })).toBe('V-1');
		expect(quoteCustomerIdNumber({ customer: null })).toBe('');
	});
});

describe('actionButtonClasses', () => {
	it('resolves variants', () => {
		expect(actionButtonClasses('danger')).toContain('bg-error-container');
		expect(actionButtonClasses('neutral')).toContain('text-brand-navy');
	});
});

describe('coerceNewCustomer', () => {
	it('passes only complete new customers', () => {
		const full = { firstName: 'Ana', lastName: 'Paz' } as never;
		expect(coerceNewCustomer(full)).toBe(full);
		expect(coerceNewCustomer({ firstName: 'Ana' } as never)).toBeUndefined();
		expect(coerceNewCustomer(null)).toBeUndefined();
	});
});

describe('canSubmitAssignCustomer', () => {
	it('requires existing id or complete new customer', () => {
		expect(canSubmitAssignCustomer('c-1', null)).toBe(true);
		expect(canSubmitAssignCustomer('', { firstName: 'Ana', lastName: 'Paz' } as never)).toBe(true);
		expect(canSubmitAssignCustomer('', null)).toBe(false);
		expect(canSubmitAssignCustomer('', { firstName: 'Ana' } as never)).toBe(false);
	});
});
