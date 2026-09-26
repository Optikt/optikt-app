import { describe, it, expect } from 'vitest';
import { isNotificationLink, type NotificationLink } from './notifications';

describe('isNotificationLink', () => {
	it('accepts product links', () => {
		expect(isNotificationLink('/products/abc-123')).toBe(true);
	});

	it('accepts support ticket links', () => {
		expect(isNotificationLink('/support/abc-123')).toBe(true);
	});

	it('rejects bare prefixes', () => {
		expect(isNotificationLink('/products/')).toBe(false);
		expect(isNotificationLink('/support/')).toBe(false);
	});

	it('rejects unrelated paths and hashes', () => {
		expect(isNotificationLink('#')).toBe(false);
		expect(isNotificationLink('/dashboard')).toBe(false);
		expect(isNotificationLink('/support')).toBe(false);
	});

	it('narrows the type', () => {
		const value = '/support/xyz';
		if (isNotificationLink(value)) {
			const link: NotificationLink = value;
			expect(link).toBe('/support/xyz');
		} else {
			throw new Error('expected a notification link');
		}
	});
});
