export interface ProductNameSuggestionOptions {
	brandName?: string | null;
	supplierName?: string | null;
	personalCode?: string | null;
}

function normalizeSegment(value?: string | null): string {
	return value?.trim().replace(/\s+/g, ' ') ?? '';
}

export function buildProductNameSuggestion({
	brandName,
	supplierName,
	personalCode
}: ProductNameSuggestionOptions): string {
	const commercialReference = normalizeSegment(brandName) || normalizeSegment(supplierName);
	const ownCode = normalizeSegment(personalCode);

	if (!commercialReference) return '';
	if (!ownCode) return commercialReference;

	return `${commercialReference} ${ownCode}`;
}
