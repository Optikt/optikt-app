import { describe, expect, it } from 'vitest';
import { buildChangedFields, hasChangedFields } from './buildChangedFields';

const original = {
	firstName: 'Ana',
	idNumber: 'V-123',
	birthDate: '2000-03-09',
	gender: 'FEMENINO',
	notes: null as string | null,
	price: 10,
	phones: ['+58 412 0000000'],
	meta: { a: 1, b: 2 }
};

describe('buildChangedFields', () => {
	it('omite claves undefined (campo no enviado = no tocar)', () => {
		expect(buildChangedFields(original, { firstName: undefined, gender: 'OTRO' })).toEqual({
			gender: 'OTRO'
		});
	});

	it('convierte "" en null solo para las claves de emptyToNull', () => {
		const changes = buildChangedFields(
			original,
			{ idNumber: '', firstName: '' },
			{ emptyToNull: ['idNumber'] }
		);
		expect(changes).toEqual({ idNumber: null, firstName: '' });
	});

	it('no devuelve claves sin cambios', () => {
		const changes = buildChangedFields(original, {
			firstName: 'Ana',
			price: 10,
			phones: ['+58 412 0000000'],
			meta: { b: 2, a: 1 }
		});
		expect(changes).toEqual({});
		expect(hasChangedFields(changes)).toBe(false);
	});

	it('trata null y "" vaciado como igual a un original null/undefined', () => {
		expect(buildChangedFields(original, { notes: '' }, { emptyToNull: ['notes'] })).toEqual({});
		expect(buildChangedFields({}, { notes: null })).toEqual({});
	});

	it('"" sin emptyToNull sobre un null guardado no es cambio (re-guardar el form)', () => {
		const changes = buildChangedFields(original, { notes: '' });
		expect(changes).toEqual({});
		expect(hasChangedFields(changes)).toBe(false);
	});

	it('no confunde "" ni booleanos con números', () => {
		expect(buildChangedFields({ discount: '' }, { discount: 0 })).toEqual({ discount: 0 });
		expect(buildChangedFields({ discount: '  ' }, { discount: 0 })).toEqual({ discount: 0 });
		expect(buildChangedFields({ flag: true }, { flag: 1 })).toEqual({ flag: 1 });
	});

	it('compara números contra numéricos guardados como string', () => {
		expect(buildChangedFields({ price: '10.50' }, { price: 10.5 })).toEqual({});
		expect(buildChangedFields({ price: '10.50' }, { price: 11 })).toEqual({ price: 11 });
	});

	it('detecta cambios en arrays y objetos', () => {
		expect(buildChangedFields(original, { phones: [] })).toEqual({ phones: [] });
		expect(buildChangedFields(original, { meta: { a: 1, b: 3 } })).toEqual({
			meta: { a: 1, b: 3 }
		});
	});

	it('detecta booleanos y false explícito', () => {
		expect(buildChangedFields({ isTaxable: true }, { isTaxable: false })).toEqual({
			isTaxable: false
		});
		expect(buildChangedFields({ isTaxable: false }, { isTaxable: false })).toEqual({});
	});
});
