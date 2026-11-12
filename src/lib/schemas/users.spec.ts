import { describe, expect, it } from 'vitest';
import { UserPreferenceSchema } from './users';

describe('UserPreferenceSchema', () => {
	it('acepta sales.view con los valores soportados', () => {
		expect(UserPreferenceSchema.safeParse({ key: 'sales.view', value: 'list' }).success).toBe(true);
		expect(UserPreferenceSchema.safeParse({ key: 'sales.view', value: 'grid' }).success).toBe(true);
	});

	it('rechaza claves desconocidas (agregar una preferencia = agregar una rama acá)', () => {
		expect(UserPreferenceSchema.safeParse({ key: 'tema', value: 'grid' }).success).toBe(false);
		expect(UserPreferenceSchema.safeParse({ value: 'grid' }).success).toBe(false);
	});

	it('rechaza valores inválidos para sales.view', () => {
		expect(UserPreferenceSchema.safeParse({ key: 'sales.view', value: 'tablero' }).success).toBe(
			false
		);
		expect(UserPreferenceSchema.safeParse({ key: 'sales.view', value: 7 }).success).toBe(false);
	});

	it('narrowea el valor según la clave', () => {
		const parsed = UserPreferenceSchema.parse({ key: 'sales.view', value: 'grid' });
		expect(parsed.key).toBe('sales.view');
		expect(parsed.value).toBe('grid');
	});
});
