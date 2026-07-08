/**
 * Shared helpers for sale wizard components (Step 2, Step 3, NewSaleForm).
 * Pure functions that operate on SaleItemRow + data arrays.
 */

import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { SaleItemRow, LensSaleItemRow, FreeSaleItemRow, LensPairEntry } from './newSaleTypes';
import { LensType, getFreeItemCategoryLabel } from '$lib/shared/enums/lensTypes';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import { clampDiscountValue, computeDiscount, isDiscountValueValid } from '$lib/utils';
import { decomposePrice, type TaxableItem } from '$lib/shared/tax';

// ============================================================================
// ITEM LOOKUPS
// ============================================================================

export function findProduct(
	item: SaleItemRow,
	products: ProductWithRelations[]
): ProductWithRelations | undefined {
	if (item.kind === 'product' && item.productId) {
		return products.find((p) => p.id === item.productId);
	}
	return undefined;
}

export function findLensItem(
	item: SaleItemRow,
	lensItems: LensCatalogItemWithRelations[]
): LensCatalogItemWithRelations | undefined {
	if (item.kind !== 'lens' || !item.lensPair.catalogItemId) return undefined;
	return lensItems.find((l) => l.id === item.lensPair.catalogItemId);
}

export function getItemName(
	item: SaleItemRow,
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): string {
	if (item.kind === 'product') {
		return findProduct(item, products)?.name ?? '-';
	}
	return findLensItem(item, lensItems)?.name ?? '-';
}

export function getRequestedProductQuantity(
	items: SaleItemRow[],
	productId: string,
	excludeItemId?: string
): number {
	return items.reduce((sum, item) => {
		if (item.kind !== 'product' || item.productId !== productId || item.id === excludeItemId) {
			return sum;
		}

		return sum + Math.max(item.quantity, 0);
	}, 0);
}

export function getAvailableProductStock(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	productId: string,
	excludeItemId?: string
): number | null {
	if (!productId) return null;

	const product = products.find((candidate) => candidate.id === productId);
	const stock = product?.stock ?? null;
	if (stock === null) return null;

	return Math.max(stock - getRequestedProductQuantity(items, productId, excludeItemId), 0);
}

// ============================================================================
// PRICING
// ============================================================================

export function computeItemDiscount(item: SaleItemRow): number {
	const lineTotal = getItemDiscountBase(item);
	const discountValue = clampDiscountValue(item.discount, item.discountType, lineTotal);
	return computeDiscount(discountValue, item.discountType, lineTotal);
}

export function itemLineTotal(item: SaleItemRow): number {
	return getItemDiscountBase(item) - computeItemDiscount(item);
}

export function step2ItemLineTotal(item: SaleItemRow): number {
	const qty = item.kind === 'product' || item.kind === 'free' ? item.quantity : 1;
	return item.unitPrice * qty;
}

export function getItemDiscountBase(item: SaleItemRow): number {
	const qty = item.kind === 'product' || item.kind === 'free' ? item.quantity : 1;
	return item.unitPrice * qty;
}

export function getItemDiscountMax(item: SaleItemRow): number {
	return item.discountType === 'PERCENTAGE' ? 100 : getItemDiscountBase(item);
}

export function isItemDiscountValid(item: SaleItemRow): boolean {
	return isDiscountValueValid(item.discount, item.discountType, getItemDiscountBase(item));
}

export function getLensTreatmentsTotal(item: SaleItemRow): number {
	if (item.kind !== 'lens') return 0;
	const eyeCount = getEnabledEyeCount(item);
	return item.treatments.reduce((sum, treatment) => sum + treatment.price * eyeCount, 0);
}

export function calculateSaleSummarySubtotal(items: SaleItemRow[]): number {
	return items.reduce((acc, item) => acc + itemLineTotal(item) + getLensTreatmentsTotal(item), 0);
}

// ============================================================================
// PRESCRIPTION VALIDATION
// ============================================================================

export interface PrescriptionFieldErrors {
	odSphere?: string;
	odCylinder?: string;
	odAxis?: string;
	odAddition?: string;
	oiSphere?: string;
	oiCylinder?: string;
	oiAxis?: string;
	oiAddition?: string;
	odDp?: string;
	oiDp?: string;
	odNp?: string;
	oiNp?: string;
	doctorName?: string;
}

export interface PersistedDisplayGroup<
	T extends {
		id: string;
		itemType: string;
		lensCatalogItemId: string | null;
		quantity: number;
		unitPrice: number;
		discount: number;
		discountType: string;
	}
> {
	key: string;
	item: T;
	quantity: number;
	discountAmount: number;
	lineTotal: number;
	treatments: T[];
}

export function buildPersistedDisplayGroups<
	T extends {
		id: string;
		itemType: string;
		lensCatalogItemId: string | null;
		odSphere?: number | null;
		odCylinder?: number | null;
		odAxis?: number | null;
		odAddition?: number | null;
		osSphere?: number | null;
		osCylinder?: number | null;
		osAxis?: number | null;
		osAddition?: number | null;
		quantity: number;
		unitPrice: number;
		discount: number;
		discountType: string;
	}
>(
	items: T[],
	mainItems: T[],
	lensPairType: string,
	treatmentType: string,
	getParentId: (item: T) => string | null | undefined
): PersistedDisplayGroup<T>[] {
	const groups: PersistedDisplayGroup<T>[] = [];
	const lensGroupMap = new Map<string, PersistedDisplayGroup<T>>();

	function isLegacySplitLensItem(item: T): boolean {
		const hasOdValues =
			item.odSphere != null ||
			item.odCylinder != null ||
			item.odAxis != null ||
			item.odAddition != null;
		const hasOsValues =
			item.osSphere != null ||
			item.osCylinder != null ||
			item.osAxis != null ||
			item.osAddition != null;

		// Legacy sales/quotes stored one row per eye but always wrote the Rx into OD fields.
		// Only those ambiguous historical rows should be merged for display.
		return hasOdValues && !hasOsValues;
	}

	function getTreatments(parentId: string): T[] {
		return items.filter(
			(item) => item.itemType === treatmentType && getParentId(item) === parentId
		);
	}

	for (const item of mainItems) {
		const discountAmount = computeDiscount(
			item.discount,
			item.discountType,
			item.unitPrice * item.quantity
		);
		const lineTotal = item.unitPrice * item.quantity - discountAmount;

		if (item.itemType === lensPairType && item.lensCatalogItemId && isLegacySplitLensItem(item)) {
			const existing = lensGroupMap.get(item.lensCatalogItemId);
			if (existing) {
				existing.quantity += item.quantity;
				existing.discountAmount += discountAmount;
				existing.lineTotal += lineTotal;
				existing.treatments.push(...getTreatments(item.id));
			} else {
				const group: PersistedDisplayGroup<T> = {
					key: `lens-${item.lensCatalogItemId}`,
					item,
					quantity: item.quantity,
					discountAmount,
					lineTotal,
					treatments: [...getTreatments(item.id)]
				};

				lensGroupMap.set(item.lensCatalogItemId, group);
				groups.push(group);
			}
		} else {
			groups.push({
				key: item.id,
				item,
				quantity: item.quantity,
				discountAmount,
				lineTotal,
				treatments: getTreatments(item.id)
			});
		}
	}

	return groups;
}

/** Determine which eyes need Rx validation based on enabled lens items */
export function getRequiredEyes(items: SaleItemRow[]): { needsOd: boolean; needsOi: boolean } {
	let needsOd = false;
	let needsOi = false;
	for (const item of items) {
		if (item.kind === 'lens') {
			if (item.lensPair.od.enabled) needsOd = true;
			if (item.lensPair.oi.enabled) needsOi = true;
		}
	}
	return { needsOd, needsOi };
}

function validateNumericEyeFields(
	sphere: number | null,
	cylinder: number | null,
	axis: number | null,
	addition: number | null,
	requiresAddition: boolean
): Record<string, string> {
	const errs: Record<string, string> = {};
	if (sphere === null && cylinder === null) {
		errs.sphere = 'Esfera o cilindro requerido';
		errs.cylinder = 'Esfera o cilindro requerido';
	}
	if (cylinder !== null && cylinder > 0) {
		errs.cylinder = 'Cilindro debe ser negativo o cero';
	}
	if (cylinder !== null && cylinder !== 0 && axis === null) {
		errs.axis = 'Eje requerido con cilindro';
	}
	if (requiresAddition) {
		if (addition === null || addition === 0) {
			errs.addition = 'Adición requerida';
		}
	}
	return errs;
}

/**
 * Validate a single lens pair's prescription fields.
 * Returns empty object when valid.
 */
export function validateLensPair(pair: LensPairEntry): PrescriptionFieldErrors {
	const errors: PrescriptionFieldErrors = {};
	const requiresAddition = pair.lensType !== LensType.MONOFOCAL;
	const needsPrescription = pair.od.enabled || pair.oi.enabled;
	if (needsPrescription && (!pair.doctorName || pair.doctorName.trim() === '')) {
		errors.doctorName = 'Doctor es requerido';
	}
	if (pair.od.enabled) {
		const od = validateNumericEyeFields(
			pair.od.prescription.sphere,
			pair.od.prescription.cylinder,
			pair.od.prescription.axis,
			pair.od.prescription.addition,
			requiresAddition
		);
		if (od.sphere) errors.odSphere = od.sphere;
		if (od.cylinder) errors.odCylinder = od.cylinder;
		if (od.axis) errors.odAxis = od.axis;
		if (od.addition) errors.odAddition = od.addition;
		if (pair.od.dp != null && (pair.od.dp < 10 || pair.od.dp > 80)) {
			errors.odDp = 'DP debe ser 10-80';
		}
		if (pair.od.np != null && (pair.od.np < 10 || pair.od.np > 80)) {
			errors.odNp = 'NP debe ser 10-80';
		}
	}
	if (pair.oi.enabled) {
		const oi = validateNumericEyeFields(
			pair.oi.prescription.sphere,
			pair.oi.prescription.cylinder,
			pair.oi.prescription.axis,
			pair.oi.prescription.addition,
			requiresAddition
		);
		if (oi.sphere) errors.oiSphere = oi.sphere;
		if (oi.cylinder) errors.oiCylinder = oi.cylinder;
		if (oi.axis) errors.oiAxis = oi.axis;
		if (oi.addition) errors.oiAddition = oi.addition;
		if (pair.oi.dp != null && (pair.oi.dp < 10 || pair.oi.dp > 80)) {
			errors.oiDp = 'DP debe ser 10-80';
		}
		if (pair.oi.np != null && (pair.oi.np < 10 || pair.oi.np > 80)) {
			errors.oiNp = 'NP debe ser 10-80';
		}
	}
	return errors;
}

/** Validate a single lens item's prescription fields. Returns empty object when valid. */
export function validateLensPrescription(item: SaleItemRow): PrescriptionFieldErrors {
	if (item.kind !== 'lens') return {};
	return validateLensPair(item.lensPair);
}

export function hasLensPrescriptionErrors(item: SaleItemRow): boolean {
	if (item.kind !== 'lens') return false;
	return Object.keys(validateLensPrescription(item)).length > 0;
}

function validateEyeFields(
	sphere: string,
	cylinder: string,
	axis: string,
	addition: string,
	requiresAddition: boolean
): Record<string, string> {
	const errs: Record<string, string> = {};

	if (sphere === '' && cylinder === '') {
		errs.sphere = 'Esfera o cilindro requerido';
		errs.cylinder = 'Esfera o cilindro requerido';
	}

	const cyl = parseFloat(cylinder);
	if (!isNaN(cyl) && cyl !== 0 && axis === '') {
		errs.axis = 'Eje requerido con cilindro';
	}

	if (requiresAddition) {
		const add = parseFloat(addition);
		if (addition === '' || isNaN(add) || add === 0) {
			errs.addition = 'Adición requerida';
		}
	}

	return errs;
}

/** Validate prescription fields. Returns empty object when all valid. */
export function validatePrescriptionFields(
	values: {
		odSphere: string;
		odCylinder: string;
		odAxis: string;
		odAddition: string;
		oiSphere: string;
		oiCylinder: string;
		oiAxis: string;
		oiAddition: string;
		lensType: string;
		doctorName: string;
	},
	needsOd: boolean,
	needsOi: boolean
): PrescriptionFieldErrors {
	const errors: PrescriptionFieldErrors = {};
	const requiresAddition = values.lensType !== LensType.MONOFOCAL;
	const needsPrescription = needsOd || needsOi;

	if (needsPrescription && (!values.doctorName || values.doctorName.trim() === '')) {
		errors.doctorName = 'Doctor es requerido';
	}

	if (needsOd) {
		const od = validateEyeFields(
			values.odSphere,
			values.odCylinder,
			values.odAxis,
			values.odAddition,
			requiresAddition
		);
		if (od.sphere) errors.odSphere = od.sphere;
		if (od.cylinder) errors.odCylinder = od.cylinder;
		if (od.axis) errors.odAxis = od.axis;
		if (od.addition) errors.odAddition = od.addition;
	}

	if (needsOi) {
		const oi = validateEyeFields(
			values.oiSphere,
			values.oiCylinder,
			values.oiAxis,
			values.oiAddition,
			requiresAddition
		);
		if (oi.sphere) errors.oiSphere = oi.sphere;
		if (oi.cylinder) errors.oiCylinder = oi.cylinder;
		if (oi.axis) errors.oiAxis = oi.axis;
		if (oi.addition) errors.oiAddition = oi.addition;
	}

	return errors;
}

export function hasPrescriptionErrors(errors: PrescriptionFieldErrors): boolean {
	return Object.keys(errors).length > 0;
}

export type LensConfirmationEye = 'OD' | 'OI';
export type LensConfirmationEyeStatus = 'in-range' | 'out-of-range' | 'lab-review';

export interface LensConfirmationEyeResult {
	eye: LensConfirmationEye;
	status: LensConfirmationEyeStatus;
	prescriptionSummary: string;
}

export interface LensConfirmationItemResult {
	itemId: string;
	lensName: string;
	catalogLensType: string;
	prescriptionLensType: string;
	typeMatches: boolean;
	hasRanges: boolean;
	eyes: LensConfirmationEyeResult[];
	rangeWarnings: string[];
}

export interface FreeItemConfirmationResult {
	itemId: string;
	categoryLabel: string;
	description: string;
	unitPrice: number;
	hasCost: boolean;
}

export interface Step2PrescriptionConfirmation {
	hasLensItems: boolean;
	lensCount: number;
	hasMultipleLenses: boolean;
	items: LensConfirmationItemResult[];
	freeItems: FreeItemConfirmationResult[];
}

export interface LensTypeSuggestionState {
	catalogLensType: string | null;
	catalogLensTypes: string[];
	hasMixedCatalogLensTypes: boolean;
	conflictingPrescriptionLensType: string | null;
}

function parseNullablePrescriptionValue(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	if (value.trim() === '') return null;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableAdditionValue(value: string | number | null | undefined): number | null {
	const parsed = parseNullablePrescriptionValue(value);
	if (parsed === null || parsed === 0) return null;
	return parsed;
}

function parseNullableAxisValue(
	value: string | number | null | undefined,
	cylinder: number | null
): number | null {
	if (cylinder === null || cylinder === 0) return null;
	return parseNullablePrescriptionValue(value);
}

function formatSignedOpticalValue(value: number | null): string {
	if (value === null) return '-';
	return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function formatAxisValue(value: number | null): string {
	if (value === null) return '-';
	return `${Math.round(value)}°`;
}

function buildEyePrescriptionSummary(
	sphere: number | null,
	cylinder: number | null,
	axis: number | null,
	addition: number | null
): string {
	const parts = [`Esf ${formatSignedOpticalValue(sphere)}`];

	if (cylinder !== null && cylinder !== 0) {
		parts.push(`Cil ${formatSignedOpticalValue(cylinder)}`);
		parts.push(`Eje ${formatAxisValue(axis)}`);
	}

	if (addition !== null && addition !== 0) {
		parts.push(`Add ${formatSignedOpticalValue(addition)}`);
	}

	return parts.join(' · ');
}

function isWithinOpticalRange(
	value: number | null,
	min: number | null,
	max: number | null
): boolean {
	if (value === null) return true;
	if (min !== null && value < min) return false;
	if (max !== null && value > max) return false;
	return true;
}

function buildLensConfirmationEyeResult(
	eye: LensConfirmationEye,
	enabled: boolean,
	values: {
		sphere: string | number | null | undefined;
		cylinder: string | number | null | undefined;
		axis: string | number | null | undefined;
		addition: string | number | null | undefined;
	},
	ranges: LensCatalogItemWithRelations['ranges']
): LensConfirmationEyeResult | null {
	if (!enabled) return null;

	const sphere = parseNullablePrescriptionValue(values.sphere);
	const cylinder = parseNullablePrescriptionValue(values.cylinder);
	const axis = parseNullableAxisValue(values.axis, cylinder);
	const addition = parseNullableAdditionValue(values.addition);
	const prescriptionSummary = buildEyePrescriptionSummary(sphere, cylinder, axis, addition);

	if (ranges.length === 0) {
		return {
			eye,
			status: 'lab-review',
			prescriptionSummary
		};
	}

	const fitsAnyRange = ranges.some(
		(range) =>
			isWithinOpticalRange(sphere, range.sphereMin, range.sphereMax) &&
			isWithinOpticalRange(cylinder, range.cylinderMin ?? null, range.cylinderMax ?? null) &&
			isWithinOpticalRange(addition, range.additionMin ?? null, range.additionMax ?? null)
	);

	return {
		eye,
		status: fitsAnyRange ? 'in-range' : 'out-of-range',
		prescriptionSummary
	};
}

export function buildStep2PrescriptionConfirmation(
	items: SaleItemRow[],
	lensItems: LensCatalogItemWithRelations[]
): Step2PrescriptionConfirmation {
	const lensResults = (
		items.filter(
			(item): item is LensSaleItemRow => item.kind === 'lens' && item.lensPair.catalogItemId !== ''
		) as LensSaleItemRow[]
	).map((item) => {
		const lens = findLensItem(item, lensItems);
		const ranges = lens?.ranges ?? [];
		const pair = item.lensPair;
		const eyes = [
			buildLensConfirmationEyeResult(
				'OD',
				pair.od.enabled,
				{
					sphere: pair.od.prescription.sphere,
					cylinder: pair.od.prescription.cylinder,
					axis: pair.od.prescription.axis,
					addition: pair.od.prescription.addition
				},
				ranges
			),
			buildLensConfirmationEyeResult(
				'OI',
				pair.oi.enabled,
				{
					sphere: pair.oi.prescription.sphere,
					cylinder: pair.oi.prescription.cylinder,
					axis: pair.oi.prescription.axis,
					addition: pair.oi.prescription.addition
				},
				ranges
			)
		].filter((result): result is LensConfirmationEyeResult => result !== null);

		const rangeWarnings = eyes
			.filter((eye) => eye.status === 'out-of-range')
			.map((eye) => `${eye.eye} (${eye.prescriptionSummary}) fuera del rango óptico del cristal`);

		return {
			itemId: item.id,
			lensName: lens?.name ?? 'Lente por seleccionar',
			catalogLensType: lens?.type ?? '',
			prescriptionLensType: pair.lensType,
			typeMatches: lens?.type === pair.lensType,
			hasRanges: ranges.length > 0,
			eyes,
			rangeWarnings
		};
	});

	const freeResults: FreeItemConfirmationResult[] = (
		items.filter((item): item is FreeSaleItemRow => item.kind === 'free') as FreeSaleItemRow[]
	).map((item) => ({
		itemId: item.id,
		categoryLabel: getFreeItemCategoryLabel(item.freeItem.category),
		description: item.freeItem.description,
		unitPrice: item.unitPrice,
		hasCost: item.freeItem.unitCost !== null && item.freeItem.unitCost > 0
	}));

	return {
		hasLensItems: lensResults.length > 0,
		lensCount: lensResults.length,
		hasMultipleLenses: lensResults.length > 1,
		items: lensResults,
		freeItems: freeResults
	};
}

export function getLensRangeWarningsForItem(
	itemId: string,
	confirmation: Step2PrescriptionConfirmation
): string[] {
	return confirmation.items.find((item) => item.itemId === itemId)?.rangeWarnings ?? [];
}

export function getLensTypeSuggestionState(
	items: SaleItemRow[],
	lensItems: LensCatalogItemWithRelations[],
	existingPrescriptionLensType?: string | null
): LensTypeSuggestionState {
	const catalogLensTypes = Array.from(
		new Set(
			items
				.filter((item) => item.kind === 'lens' && item.lensPair.catalogItemId !== '')
				.map((item) => findLensItem(item, lensItems)?.type ?? null)
				.filter((type): type is string => Boolean(type))
		)
	);

	const catalogLensType = catalogLensTypes.length === 1 ? catalogLensTypes[0] : null;

	return {
		catalogLensType,
		catalogLensTypes,
		hasMixedCatalogLensTypes: catalogLensTypes.length > 1,
		conflictingPrescriptionLensType:
			catalogLensType &&
			existingPrescriptionLensType &&
			existingPrescriptionLensType !== catalogLensType
				? existingPrescriptionLensType
				: null
	};
}

// ============================================================================
// EYE COUNT
// ============================================================================

/** Get the number of enabled eyes for a lens item. */
export function getEnabledEyeCount(item: SaleItemRow): number {
	if (item.kind !== 'lens') return 0;
	return (item.lensPair.od.enabled ? 1 : 0) + (item.lensPair.oi.enabled ? 1 : 0);
}

// ============================================================================
// TAX HELPERS
// ============================================================================

/** Build TaxableItem[] from wizard items for use with computeTaxBreakdown. */
export function buildTaxItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[],
	defaultTaxRate: number = DEFAULT_TAX_RATE
): TaxableItem[] {
	const result: TaxableItem[] = [];
	for (const item of items) {
		if (item.kind === 'product') {
			const product = products.find((p) => p.id === item.productId);
			result.push({
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: product?.isTaxable ?? true,
				taxRate: defaultTaxRate
			});
		} else if (item.kind === 'lens') {
			const lens = lensItems.find((l) => l.id === item.lensPair.catalogItemId);
			result.push({
				unitPrice: item.unitPrice,
				quantity: 1,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: lens?.isTaxable ?? false,
				taxRate: defaultTaxRate
			});
			const eyeCount = getEnabledEyeCount(item);
			for (const t of item.treatments) {
				result.push({
					unitPrice: t.price,
					quantity: eyeCount,
					discount: 0,
					discountType: 'FIXED',
					isTaxable: t.isTaxable,
					taxRate: defaultTaxRate
				});
			}
		}
	}
	return result;
}

/** Compute tax breakdown from stored snapshot fields on persisted items. */
export function computeSnapshotTaxBreakdown(
	items: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable: boolean | null;
	}[],
	documentTaxRate: number | null
): { taxableBase: number; exemptTotal: number; taxAmount: number } {
	let taxableBase = 0;
	let exemptTotal = 0;
	let taxAmount = 0;
	const taxRate = documentTaxRate ?? 0;

	for (const item of items) {
		const lineTotal =
			item.unitPrice * item.quantity -
			computeDiscount(item.discount, item.discountType, item.unitPrice * item.quantity);
		const isTaxable = item.snapshotIsTaxable ?? false;

		if (isTaxable && taxRate > 0) {
			const { base, tax } = decomposePrice(lineTotal, taxRate);
			taxableBase += base;
			taxAmount += tax;
		} else {
			exemptTotal += lineTotal;
		}
	}

	return { taxableBase, exemptTotal, taxAmount };
}

export function getSnapshotTaxLabel(documentTaxRate: number | null): string | null {
	if (documentTaxRate == null || documentTaxRate <= 0) {
		return null;
	}

	const formatter = new Intl.NumberFormat('es-VE', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	});

	return `IVA (${formatter.format(documentTaxRate)}%)`;
}
