import { describe, it, expect } from 'vitest';
import { cn } from './index';

describe('cn', () => {
	it('lets later classes override conflicting tailwind utilities', () => {
		expect(cn('max-w-sm', 'max-w-2xl')).toBe('max-w-2xl');
		expect(cn('p-4 gap-4', 'p-0 gap-0')).toBe('p-0 gap-0');
		expect(cn('sm:max-w-sm', 'sm:max-w-2xl')).toBe('sm:max-w-2xl');
	});

	it('keeps non tailwind classes and drops falsy values', () => {
		expect(cn('inline-flex', null, undefined, '', 'text-brand-navy')).toBe(
			'inline-flex text-brand-navy'
		);
	});
});
