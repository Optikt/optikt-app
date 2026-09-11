import { DiscountType } from '$lib/shared/enums';
import { FreeItemCategory, LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
import type { SaleItemInput, UpdateSaleInput } from '$lib/schemas/sales';
import type { SupplierTreatment } from '$lib/server/db/schema';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { getCatalogItemsByIds } from '$lib/remote/catalog.remote';
import { cacheCatalogItems, getCachedLensItems } from './catalogCache.svelte';
import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import { fromISO, fromISODate, nowUTC, toUTCString } from '$lib/dates';
import { computeDiscount } from '$lib/utils';

export type EditableItem = SaleItemInput & { _removed?: boolean };

export function createEmptyLensDraft(): EditableItem {
	return {
		itemType: SaleItemType.LENS_PAIR,
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		_removed: false
	};
}

export function existingItemToInput(item: SaleItemWithDetails): EditableItem {
	return {
		id: item.id,
		itemType: item.itemType,
		productId: item.productId ?? undefined,
		lensCatalogItemId: item.lensCatalogItemId ?? undefined,
		parentSaleItemId: item.parentSaleItemId ?? undefined,
		supplierTreatmentId: item.supplierTreatmentId ?? undefined,
		prescriptionId: item.prescriptionId ?? undefined,
		odSphere: item.odSphere ?? undefined,
		odCylinder: item.odCylinder ?? undefined,
		odAxis: item.odAxis ?? undefined,
		odAddition: item.odAddition ?? undefined,
		odAltura: item.odAltura ?? undefined,
		osSphere: item.osSphere ?? undefined,
		osCylinder: item.osCylinder ?? undefined,
		osAxis: item.osAxis ?? undefined,
		osAddition: item.osAddition ?? undefined,
		osAltura: item.osAltura ?? undefined,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: item.discountType as DiscountType,
		snapshotName: item.snapshotName ?? undefined,
		snapshotSku: item.snapshotSku ?? undefined,
		snapshotBrand: item.snapshotBrand ?? undefined,
		snapshotBaseCost: item.snapshotBaseCost ?? undefined,
		snapshotMountingPrice: item.snapshotMountingPrice ?? undefined,
		snapshotShippingPrice: item.snapshotShippingPrice ?? undefined,
		snapshotSalePrice: item.snapshotSalePrice ?? undefined,
		snapshotPriceType: item.snapshotPriceType ?? undefined,
		snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? undefined,
		snapshotIsTaxable: item.snapshotIsTaxable ?? undefined,
		shippingCostPending: item.shippingCostPending ?? undefined,
		freeItemCategory: (item.freeDetails?.category as FreeItemCategory) ?? undefined,
		freeItemDescription: item.freeDetails?.description ?? undefined,
		freeItemUnitCost: item.freeDetails?.unitCost ?? undefined,
		freeItemSupplierId: item.freeDetails?.supplierId ?? undefined,
		freeItemOpticalNotes: item.freeDetails?.opticalNotes ?? undefined,
		notes: item.notes ?? undefined,
		_removed: false
	};
}

export function buildLensInputFromDraft(
	editLensTmp: EditableItem,
	selectedLens: {
		name?: string | null;
		supplier?: { name?: string | null } | null;
		pairPurchasePrice?: number | null;
		mountingPrice?: number | null;
		shippingPrice?: number | null;
		salePrice?: number | null;
		priceType?: string | null;
		isTaxable?: boolean | null;
	} | null
): EditableItem {
	const lensName = selectedLens?.name ?? editLensTmp.snapshotName;
	const supplierName = selectedLens?.supplier?.name ?? editLensTmp.snapshotBrand;
	return {
		...editLensTmp,
		snapshotName: lensName,
		snapshotBrand: supplierName,
		snapshotBaseCost: selectedLens?.pairPurchasePrice ?? editLensTmp.snapshotBaseCost,
		snapshotMountingPrice: selectedLens?.mountingPrice ?? editLensTmp.snapshotMountingPrice,
		snapshotShippingPrice: editLensTmp.shippingCostPending
			? undefined
			: (selectedLens?.shippingPrice ?? editLensTmp.snapshotShippingPrice),
		snapshotSalePrice: selectedLens?.salePrice ?? editLensTmp.snapshotSalePrice,
		snapshotPriceType: selectedLens?.priceType ?? editLensTmp.snapshotPriceType,
		snapshotIsTaxable: selectedLens?.isTaxable ?? editLensTmp.snapshotIsTaxable ?? true
	};
}

export function previewSubtotalForItems(
	activeItems: EditableItem[],
	discount: number,
	discountType: string
): { subtotal: number; globalDiscount: number; total: number } {
	const subtotal = activeItems.reduce((acc, item) => {
		const lineTotal = item.unitPrice * item.quantity;
		const itemDiscount = computeDiscount(
			item.discount ?? 0,
			(item.discountType ?? DiscountType.FIXED) as DiscountTypeEnum,
			lineTotal
		);
		return acc + lineTotal - itemDiscount;
	}, 0);
	const globalDiscount = computeDiscount(
		discount ?? 0,
		(discountType ?? DiscountType.FIXED) as DiscountTypeEnum,
		subtotal
	);
	const total = Math.max(0, subtotal - globalDiscount);
	return { subtotal, globalDiscount, total };
}

export function itemDetail(item: EditableItem): string {
	const parts: string[] = [];
	if (item.snapshotSku) parts.push(item.snapshotSku);
	if (item.snapshotBrand) parts.push(item.snapshotBrand);
	if (item.itemType === SaleItemType.FREE_ITEM && item.freeItemCategory) {
		parts.push(item.freeItemCategory);
	}
	return parts.join(' · ');
}

export function hasChangesForSale(
	sale: { saleDate: string; notes: string | null; discount: number; discountType: string },
	saleDate: string,
	notes: string,
	discount: number,
	discountType: string,
	editableItems: EditableItem[]
): boolean {
	return (
		saleDate !== sale.saleDate.slice(0, 10) ||
		notes !== (sale.notes ?? '') ||
		discount !== sale.discount ||
		discountType !== sale.discountType ||
		editableItems.some((i) => i._removed) ||
		editableItems.some((i) => !i.id)
	);
}

export interface EditLensTreatment {
	supplierTreatmentId: string;
	name: string;
	price: number;
	salePrice: number;
	isTaxable: boolean;
	category: string;
	_keep?: boolean;
}

export function mapTreatmentsForEdit(
	activeItems: EditableItem[],
	itemId: string | undefined
): EditLensTreatment[] {
	return activeItems
		.filter((i) => i.parentSaleItemId === itemId && i.itemType === SaleItemType.TREATMENT)
		.map((t) => ({
			supplierTreatmentId: t.supplierTreatmentId ?? '',
			name: t.snapshotName ?? 'Tratamiento',
			price: (t.snapshotBaseCost ?? t.unitPrice) / 2,
			salePrice: t.unitPrice / 2,
			isTaxable: t.snapshotIsTaxable ?? true,
			category: t.snapshotTreatmentCategory ?? '',
			_keep: true
		}));
}

export function applyLensEdit(
	editableItems: EditableItem[],
	editingLensId: string | null,
	savedItem: EditableItem,
	treatments: EditLensTreatment[],
	brandName: string | undefined
): EditableItem[] {
	let updated = editableItems.filter((i) => {
		if (i._removed) return true;
		if (editingLensId && i.id === editingLensId) return false;
		if (editingLensId && i.parentSaleItemId === editingLensId) return false;
		return true;
	});

	updated = [...updated, savedItem];

	for (const t of treatments) {
		const treatmentRow: EditableItem = {
			itemType: SaleItemType.TREATMENT,
			parentSaleItemId: savedItem.id,
			supplierTreatmentId: t.supplierTreatmentId,
			quantity: 1,
			unitPrice: t.salePrice * 2,
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotName: t.name,
			snapshotBrand: brandName,
			snapshotTreatmentCategory: t.category,
			snapshotIsTaxable: t.isTaxable,
			snapshotBaseCost: t.price * 2,
			_removed: false
		};
		updated = [...updated, treatmentRow];
	}

	return updated;
}

export function createProductItem(
	product: {
		name: string;
		sku?: string | null;
		brand?: { name?: string | null } | null;
		isTaxable?: boolean | null;
	},
	opts: {
		productId: string;
		quantity: number;
		unitPrice: number;
		discount: number;
		discountType: string;
		notes: string;
	}
): EditableItem {
	return {
		itemType: SaleItemType.PRODUCT,
		productId: opts.productId,
		quantity: opts.quantity,
		unitPrice: opts.unitPrice,
		discount: opts.discount,
		discountType: opts.discountType as DiscountTypeEnum,
		snapshotName: product.name,
		snapshotSku: product.sku ?? undefined,
		snapshotBrand: product.brand?.name ?? undefined,
		snapshotIsTaxable: product.isTaxable ?? true,
		notes: opts.notes || undefined,
		_removed: false
	};
}

export function createFreeItem(opts: {
	category: FreeItemCategory;
	description: string;
	price: number;
	discount: number;
	discountType: string;
	notes: string;
}): EditableItem {
	return {
		itemType: SaleItemType.FREE_ITEM,
		quantity: 1,
		unitPrice: opts.price,
		discount: opts.discount,
		discountType: opts.discountType as DiscountTypeEnum,
		freeItemCategory: opts.category,
		freeItemDescription: opts.description.trim(),
		snapshotName: opts.description.trim(),
		notes: opts.notes || undefined,
		_removed: false
	};
}

export async function seedCatalogCacheForItems(
	items: { lensCatalogItemId?: string | null }[]
): Promise<void> {
	const lensIds = items.map((i) => i.lensCatalogItemId).filter((id): id is string => Boolean(id));
	if (lensIds.length === 0) return;
	const results = await getCatalogItemsByIds({ lensIds });
	cacheCatalogItems([], results.lensItems);
}

export interface LensEditContext {
	availableTreatments: SupplierTreatment[];
	selectableTreatments: SupplierTreatment[];
	selectedLens: LensCatalogItemWithRelations | null;
	showAddition: boolean;
}

export function getLensEditContext(
	lensCatalogItemId: string | undefined,
	currentTreatments: EditLensTreatment[],
	treatments: SupplierTreatment[]
): LensEditContext {
	const selectedLens = lensCatalogItemId
		? (getCachedLensItems().find((l) => l.id === lensCatalogItemId) ?? null)
		: null;
	const supplierId = selectedLens?.supplier?.id;
	const availableTreatments =
		lensCatalogItemId && supplierId ? treatments.filter((t) => t.supplierId === supplierId) : [];
	return {
		availableTreatments,
		selectableTreatments: availableTreatments.filter(
			(t) => !currentTreatments.some((et) => et.supplierTreatmentId === t.id)
		),
		selectedLens,
		showAddition: (selectedLens?.type ?? '') !== LensType.MONOFOCAL
	};
}

export interface UpdateSaleDraft {
	saleDate: string;
	notes: string;
	isCashea: boolean;
	discount: number;
	discountType: string;
	reason: string;
	removedCount: number;
	activeItems: EditableItem[];
}

export function buildUpdateSalePayload(
	sale: {
		id: string;
		saleDate: string;
		notes: string | null;
		isCashea: boolean | null;
		discount: number;
		discountType: string;
	},
	draft: UpdateSaleDraft
): UpdateSaleInput {
	const payload: UpdateSaleInput = { id: sale.id, reason: draft.reason.trim() };

	if (draft.saleDate !== sale.saleDate.slice(0, 10)) {
		const old = fromISO(sale.saleDate);
		const nd = fromISODate(draft.saleDate)!;
		const isDateOnly = !sale.saleDate.includes('T');
		const isMidnightUTC =
			old.getUTCHours() === 0 &&
			old.getUTCMinutes() === 0 &&
			old.getUTCSeconds() === 0 &&
			old.getUTCMilliseconds() === 0;
		const src = isDateOnly || isMidnightUTC ? nowUTC() : old;
		nd.setHours(src.getHours(), src.getMinutes(), src.getSeconds(), src.getMilliseconds());
		payload.saleDate = toUTCString(nd);
	}
	if (draft.notes !== (sale.notes ?? '')) {
		payload.notes = draft.notes || undefined;
	}
	if (draft.isCashea !== (sale.isCashea ?? false)) payload.isCashea = draft.isCashea;
	if (draft.discount !== sale.discount) payload.discount = draft.discount;
	if (draft.discountType !== sale.discountType)
		payload.discountType = draft.discountType as DiscountTypeEnum;

	if (
		draft.removedCount > 0 ||
		draft.activeItems.some((i) => !i.id) ||
		draft.discount !== sale.discount ||
		draft.discountType !== sale.discountType
	) {
		payload.items = draft.activeItems.map(({ _removed, ...input }) => input);
	}

	return payload;
}
