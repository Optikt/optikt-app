import { ProductType, PRODUCT_TYPE_LABELS } from '../shared/enums/productTypes';

export enum ProductGender {
	DAMA = 'DAMA',
	CABALLERO = 'CABALLERO',
	NINO = 'NIÑO',
	UNISEX = 'UNISEX',
	NO_APLICA = 'NO_APLICA'
}

export const PRODUCT_GENDER_LABELS: Record<ProductGender, string> = {
	[ProductGender.DAMA]: 'Dama',
	[ProductGender.CABALLERO]: 'Caballero',
	[ProductGender.NINO]: 'Niño',
	[ProductGender.UNISEX]: 'Unisex',
	[ProductGender.NO_APLICA]: 'No aplica'
};

export interface SkuOptions {
	type: ProductType;
	gender: ProductGender;
	materialName?: string;
	brandName?: string;
	color?: string;
	personalCode?: string;
}

/**
 * Generates a SKU based on product attributes
 * Rule: <TIPO_PRODUCTO><GENERO>-<MATERIAL>-<MARCA>-<COLOR>-<CODIGO_PROPIO>
 */
export function generateSku(options: SkuOptions): string {
	const { type, gender, materialName, brandName, color, personalCode } = options;

	// 1. TIPO_PRODUCTO
	let typePart = '';
	const typeLabel = PRODUCT_TYPE_LABELS[type] || '';
	const typeWords = typeLabel.trim().split(/\s+/);
	if (typeWords.length === 1) {
		typePart = typeWords[0].substring(0, 2).toUpperCase();
	} else if (typeWords.length > 1) {
		const first = typeWords[0][0] || '';
		const last = typeWords[typeWords.length - 1][0] || '';
		typePart = (first + last).toUpperCase();
	}

	// 2. GENERO
	let genderPart = '';
	if (gender !== ProductGender.NO_APLICA) {
		genderPart = gender.substring(0, 2).toUpperCase();
	}

	// 3. MATERIAL
	const materialPart = (materialName || '').trim().substring(0, 3).toUpperCase();

	// 4. MARCA
	let brandPart = '';
	const trimmedBrand = (brandName || '').trim();
	if (trimmedBrand) {
		const brandWords = trimmedBrand.split(/\s+/);
		if (brandWords.length === 1) {
			brandPart = brandWords[0].substring(0, 3).toUpperCase();
		} else {
			const first = brandWords[0][0] || '';
			const lastWords = brandWords[brandWords.length - 1];
			const lastTwo = lastWords.substring(0, 2).toUpperCase();
			brandPart = (first + lastTwo).toUpperCase();
		}
	}

	// 5. COLOR
	const colorPart = (color || '').trim().toUpperCase().replace(/\s+/g, '_');

	// 6. CODIGO_PROPIO
	const codePart = (personalCode || '').trim().toUpperCase();

	// Assemble
	// Rule: <TIPO_PRODUCTO><GENERO>-<MATERIAL>-<MARCA>-<COLOR>-<CODIGO_PROPIO>
	const parts = [`${typePart}${genderPart}`, materialPart, brandPart, colorPart, codePart].filter(
		(p) => p !== ''
	);

	return parts.join('-');
}
