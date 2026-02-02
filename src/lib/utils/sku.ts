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
 * Sanitize a string to only contain valid SKU characters (A-Z, 0-9)
 * Removes accents, special chars, and converts to uppercase
 */
function sanitizeForSku(str: string): string {
	return str
		.normalize('NFD') // Decompose accented characters
		.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, ''); // Keep only letters and numbers
}

/**
 * Generates a SKU based on product attributes
 * Rule: <TIPO_PRODUCTO><GENERO>-<MATERIAL>-<MARCA>-<COLOR>-<CODIGO_PROPIO>
 * All parts are sanitized to only contain A-Z and 0-9
 */
export function generateSku(options: SkuOptions): string {
	const { type, gender, materialName, brandName, color, personalCode } = options;

	// 1. TIPO_PRODUCTO (2 chars)
	let typePart = '';
	const typeLabel = PRODUCT_TYPE_LABELS[type] || '';
	const typeWordsRaw = typeLabel.trim().split(/\s+/);
	const typeWords = typeWordsRaw.map((w) => sanitizeForSku(w)).filter(Boolean);
	if (typeWords.length === 1) {
		typePart = typeWords[0].substring(0, 2);
	} else if (typeWords.length > 1) {
		typePart = (typeWords[0][0] || '') + (typeWords[typeWords.length - 1][0] || '');
	}

	// 2. GENERO (2 chars, skip if NO_APLICA)
	let genderPart = '';
	if (gender !== ProductGender.NO_APLICA) {
		genderPart = sanitizeForSku(String(gender)).substring(0, 2);
	}

	// 3. MATERIAL (3 chars)
	const materialPart = sanitizeForSku(materialName || '').substring(0, 3);

	// 4. MARCA (3 chars)
	let brandPart = '';
	const trimmedBrand = (brandName || '').trim();
	if (trimmedBrand) {
		const brandWordsRaw = trimmedBrand.split(/\s+/);
		const brandWords = brandWordsRaw.map((w) => sanitizeForSku(w)).filter(Boolean);
		if (brandWords.length === 1) {
			brandPart = brandWords[0].substring(0, 3);
		} else {
			const first = brandWords[0].substring(0, 1) || '';
			const lastTwo = brandWords[brandWords.length - 1].substring(0, 2) || '';
			brandPart = (first + lastTwo).substring(0, 3);
		}
	}

	// 5. COLOR (all chars, sanitized)
	const colorPart = sanitizeForSku(color || '');

	// 6. CODIGO_PROPIO (all chars, sanitized)
	const codePart = sanitizeForSku(personalCode || '');

	// Assemble with hyphens between non-empty parts
	const parts = [`${typePart}${genderPart}`, materialPart, brandPart, colorPart, codePart].filter(
		(p) => p !== ''
	);

	return parts.join('-');
}
