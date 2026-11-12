import { describe, expect, it } from 'vitest';
import { splitTooltip } from './tooltip';

describe('splitTooltip', () => {
	it('sin pipe devuelve solo texto', () => {
		expect(splitTooltip('Solo un texto')).toEqual({ text: 'Solo un texto' });
	});

	it('con pipe separa título y cuerpo en el primer pipe', () => {
		expect(splitTooltip('Título|Cuerpo del tooltip')).toEqual({
			title: 'Título',
			text: 'Cuerpo del tooltip'
		});
	});

	it('los pipes posteriores se conservan en el cuerpo', () => {
		expect(splitTooltip('Umbral USD|Dice si |dif × costo| supera el valor')).toEqual({
			title: 'Umbral USD',
			text: 'Dice si |dif × costo| supera el valor'
		});
	});

	it('undefined o vacío devuelven objeto vacío', () => {
		expect(splitTooltip(undefined)).toEqual({});
		expect(splitTooltip('')).toEqual({});
	});

	it('recorta espacios alrededor de título y cuerpo', () => {
		expect(splitTooltip('  Título  |  Cuerpo  ')).toEqual({ title: 'Título', text: 'Cuerpo' });
	});

	it('pipe sin título deja solo el cuerpo', () => {
		expect(splitTooltip('|solo cuerpo')).toEqual({ text: 'solo cuerpo' });
	});
});
