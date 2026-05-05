import {
	getLensTypeLabel,
	LensType,
	SaleItemType,
	TreatmentCategory
} from '$lib/shared/enums/lensTypes';

export interface PrintDocumentItem {
	itemType: string;
	snapshotName: string | null;
	product: { name: string } | null;
	lensCatalogItem: { name: string; type: string } | null;
	supplierTreatment: { name: string; category: string } | null;
	freeDetails: { description: string | null } | null;
	odSphere?: number | null;
	odCylinder?: number | null;
	odAxis?: number | null;
	odAddition?: number | null;
	osSphere?: number | null;
	osCylinder?: number | null;
	osAxis?: number | null;
	osAddition?: number | null;
}

const MATERIAL_PATTERNS = [
	{ pattern: /\bcr[\s-]?39\b/i, label: 'CR-39' },
	{ pattern: /\bpolicarbonato\b/i, label: 'Policarbonato' },
	{ pattern: /\btrivex\b/i, label: 'Trivex' },
	{ pattern: /\b(?:hi[\s-]?index|high[\s-]?index)\b/i, label: 'Hi-Index' },
	{ pattern: /\b(?:resina|organic[oa])\b/i, label: 'Resina' },
	{ pattern: /\bmineral\b/i, label: 'Mineral' }
] as const;

function normalizeSearchText(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();
}

function extractLensMaterial(rawName: string): string {
	for (const candidate of MATERIAL_PATTERNS) {
		if (candidate.pattern.test(rawName)) {
			return candidate.label;
		}
	}

	const cleaned = rawName
		.replace(/\bcristales?\b/gi, '')
		.replace(/\bmonofocal\b/gi, '')
		.replace(/\bbifocal\b/gi, '')
		.replace(/\bprogresiv[oa]s?\b/gi, '')
		.replace(/\bocupacional\b/gi, '')
		.replace(/\bfotocrom[aá]tic[oa]s?\b/gi, '')
		.replace(/\bblue\s?(?:cut|block)\b/gi, '')
		.replace(/\bantir?reflej[oa]\b/gi, '')
		.replace(/\bAR\b/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (!cleaned) {
		return 'Personalizado';
	}

	const parts = cleaned.split(' ').filter(Boolean);
	return parts.length > 1 ? parts.slice(1).join(' ') : cleaned;
}

function inferLensType(rawName: string, catalogType: string | null | undefined): string | null {
	if (catalogType && catalogType !== LensType.MONOFOCAL) {
		return getLensTypeLabel(catalogType);
	}

	const normalized = normalizeSearchText(rawName);
	if (normalized.includes('progresiv')) return getLensTypeLabel(LensType.PROGRESSIVE);
	if (normalized.includes('bifocal')) return getLensTypeLabel(LensType.BIFOCAL);
	if (normalized.includes('ocupacional')) return getLensTypeLabel(LensType.OCCUPATIONAL);
	return null;
}

function hasInherentDescriptor(rawName: string, type: 'photochromic' | 'ar' | 'blue'): boolean {
	const normalized = normalizeSearchText(rawName);

	if (type === 'photochromic') return normalized.includes('fotocromat');
	if (type === 'blue') return /\bblue\s?(cut|block)\b/.test(normalized);
	return /\bantir?reflej[oa]\b/.test(normalized) || /\bar\b/.test(normalized);
}

function lensLabel(item: PrintDocumentItem): string {
	const rawName = item.snapshotName ?? item.lensCatalogItem?.name ?? 'Personalizado';
	const parts = ['Cristal', extractLensMaterial(rawName)];
	const lensTypeLabel = inferLensType(rawName, item.lensCatalogItem?.type);

	if (lensTypeLabel) {
		parts.push(lensTypeLabel);
	}

	if (hasInherentDescriptor(rawName, 'photochromic')) {
		parts.push('Fotocromático');
	}

	if (hasInherentDescriptor(rawName, 'ar')) {
		parts.push('AR');
	}

	if (hasInherentDescriptor(rawName, 'blue')) {
		parts.push('Blueblock');
	}

	return parts.filter(Boolean).join(' ');
}

function treatmentLabel(item: PrintDocumentItem): string {
	const treatmentName = item.supplierTreatment?.name ?? item.snapshotName ?? 'Tratamiento';

	switch (item.supplierTreatment?.category) {
		case TreatmentCategory.AR:
			return `Antireflejo: ${treatmentName}`;
		case TreatmentCategory.BLUECUT:
			return `Blueblock: ${treatmentName}`;
		default:
			return treatmentName;
	}
}

export function getPrintItemLabel(item: PrintDocumentItem): string {
	switch (item.itemType) {
		case SaleItemType.PRODUCT:
			return item.product?.name ?? item.snapshotName ?? 'Producto';
		case SaleItemType.LENS_PAIR:
			return lensLabel(item);
		case SaleItemType.TREATMENT:
			return treatmentLabel(item);
		case SaleItemType.FREE_ITEM:
			return item.freeDetails?.description ?? item.snapshotName ?? 'Ítem libre';
		default:
			return item.snapshotName ?? 'Ítem';
	}
}

export function getPrintItemLabelClass(item: PrintDocumentItem): string {
	return item.itemType === SaleItemType.PRODUCT || item.itemType === SaleItemType.FREE_ITEM
		? 'font-medium text-slate-950'
		: 'font-normal text-slate-950';
}

function formatRxValue(value: number | null | undefined): string {
	if (value === null || value === undefined) return '-';
	return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function formatAxis(value: number | null | undefined): string {
	if (value === null || value === undefined) return '-';
	return `${Math.round(value)}°`;
}

function buildEyeSummary(
	eye: 'OD' | 'OI',
	sphere: number | null | undefined,
	cylinder: number | null | undefined,
	axis: number | null | undefined,
	addition: number | null | undefined
): string {
	const parts: string[] = [];

	if (sphere !== null && sphere !== undefined) {
		parts.push(formatRxValue(sphere));
	}

	if (cylinder !== null && cylinder !== undefined && cylinder !== 0) {
		parts.push(formatRxValue(cylinder));
		if (axis !== null && axis !== undefined) {
			parts.push(formatAxis(axis));
		}
	}

	if (addition !== null && addition !== undefined && addition !== 0) {
		parts.push(`Add ${formatRxValue(addition)}`);
	}

	return `${eye}: ${parts.length > 0 ? parts.join(' ') : '-'}`;
}

export function getPrintLensRxSummary(item: PrintDocumentItem): string {
	return [
		buildEyeSummary('OD', item.odSphere, item.odCylinder, item.odAxis, item.odAddition),
		buildEyeSummary('OI', item.osSphere, item.osCylinder, item.osAxis, item.osAddition)
	].join(' · ');
}

export const HALF_LETTER_RECEIPT_LIMITS = {
	itemLineCount: 5,
	paymentCount: 5,
	combinedLineCount: 9
} as const;

export function hasHalfLetterReceiptOverflowRisk({
	itemLineCount,
	paymentCount
}: {
	itemLineCount: number;
	paymentCount: number;
}): boolean {
	return (
		itemLineCount > HALF_LETTER_RECEIPT_LIMITS.itemLineCount ||
		paymentCount > HALF_LETTER_RECEIPT_LIMITS.paymentCount ||
		itemLineCount + paymentCount > HALF_LETTER_RECEIPT_LIMITS.combinedLineCount
	);
}
