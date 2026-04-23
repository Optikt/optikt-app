import { describe, it, expect } from 'vitest';
import { generateSku, ProductGender, type SkuOptions } from './sku';
import { ProductType } from '../shared/enums/productTypes';

describe('generateSku', () => {
	it('should generate SKU for single word type and gender', () => {
		const options: SkuOptions = {
			type: ProductType.FRAME, // Montura -> MO
			gender: ProductGender.DAMA, // DAMA -> DA
			materialName: 'ACETATO', // ACE
			brandName: 'Lacoste', // LAC
			color: 'Rojo', // ROJO
			personalCode: '123'
		};
		// MO + DA -> MODA
		expect(generateSku(options)).toBe('MODA-ACE-LAC-ROJO-123');
	});

	it('should generate SKU for multi-word type', () => {
		const options: SkuOptions = {
			type: ProductType.SUNGLASSES, // Lentes de sol -> LS
			gender: ProductGender.CABALLERO, // CABALLERO -> CA
			materialName: 'TITANIO', // TIT
			brandName: 'Ray-Ban', // RAY
			color: 'Negro', // NEGRO
			personalCode: '555'
		};
		expect(generateSku(options)).toBe('LSCA-TIT-RAY-NEGRO-555');
	});

	it('should handle multi-word brand name', () => {
		const options: SkuOptions = {
			type: ProductType.FRAME,
			gender: ProductGender.DAMA,
			materialName: 'ACETATO',
			brandName: 'Carolina Herrera', // C + HE -> CHE
			color: 'Dorado',
			personalCode: '789'
		};
		expect(generateSku(options)).toBe('MODA-ACE-CHE-DORADO-789');
	});

	it('should handle multi-word brand name with 3 words', () => {
		const options: SkuOptions = {
			type: ProductType.FRAME,
			gender: ProductGender.DAMA,
			materialName: 'ACETATO',
			brandName: 'French de Lenses', // F + LE -> FLE
			color: 'Azul cielo',
			personalCode: '101'
		};
		expect(generateSku(options)).toBe('MODA-ACE-FLE-AZUL-CIELO-101');
	});

	it('should preserve separators in color and personal code segments', () => {
		const options: SkuOptions = {
			type: ProductType.SUNGLASSES,
			gender: ProductGender.NO_APLICA,
			materialName: 'Metal',
			brandName: 'Augen',
			color: 'Gris Dorado',
			personalCode: 'S25666-1 C2'
		};

		expect(generateSku(options)).toBe('LS-MET-AUG-GRIS-DORADO-S25666-1-C2');
	});

	it('should collapse repeated spaces and hyphens into single delimiters', () => {
		const options: SkuOptions = {
			type: ProductType.FRAME,
			gender: ProductGender.DAMA,
			materialName: 'Acetato',
			brandName: 'Lacoste',
			color: 'Gris   -  Dorado',
			personalCode: 'BAF6007  -  C2'
		};

		expect(generateSku(options)).toBe('MODA-ACE-LAC-GRIS-DORADO-BAF6007-C2');
	});

	it('should ignore gender if NO_APLICA', () => {
		const options: SkuOptions = {
			type: ProductType.ACCESSORY, // Accesorio -> AC
			gender: ProductGender.NO_APLICA,
			materialName: 'PLASTICO',
			brandName: 'Generic',
			color: 'Blanco',
			personalCode: '001'
		};
		expect(generateSku(options)).toBe('AC-PLA-GEN-BLANCO-001');
	});

	it('should handle missing optional fields', () => {
		const options: SkuOptions = {
			type: ProductType.FRAME,
			gender: ProductGender.UNISEX
		};
		// UNISEX -> UN
		// MO + UN -> MOUN
		expect(generateSku(options)).toBe('MOUN');
	});

	it('should handle short strings', () => {
		const options: SkuOptions = {
			type: ProductType.FRAME,
			gender: ProductGender.DAMA,
			materialName: 'A',
			brandName: 'B',
			color: 'C',
			personalCode: 'D'
		};
		expect(generateSku(options)).toBe('MODA-A-B-C-D');
	});
});
