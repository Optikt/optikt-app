import { ProductType, toMaterialCategory } from '$lib/shared/enums/productTypes';

const MATERIAL_CODE_PREFIXES: Record<string, string> = {
	[ProductType.FRAME]: 'MO',
	[ProductType.CONTACT_LENS]: 'LC',
	[ProductType.ACCESSORY]: 'AC'
};

export function getMaterialCodePrefix(productType: string): string {
	const materialCategory =
		productType === ProductType.SUNGLASSES
			? toMaterialCategory(ProductType.SUNGLASSES)
			: productType;

	return MATERIAL_CODE_PREFIXES[materialCategory] ?? materialCategory.slice(0, 2).toUpperCase();
}

export function normalizeMaterialCodeSegment(name: string): string {
	const normalized = name
		.toUpperCase()
		.replace(/\s+/g, '_')
		.replace(/[^A-Z0-9_]/g, '')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 10);

	return normalized.length > 0 ? normalized : 'MATERIAL';
}

export function buildMaterialCode(name: string, productType: string, suffix?: number): string {
	const baseCode = `${getMaterialCodePrefix(productType)}_${normalizeMaterialCodeSegment(name)}`;
	if (!suffix || suffix <= 1) {
		return baseCode;
	}

	const suffixText = `_${suffix}`;
	const maxBaseLength = Math.max(1, 30 - suffixText.length);
	return `${baseCode.slice(0, maxBaseLength)}${suffixText}`;
}
