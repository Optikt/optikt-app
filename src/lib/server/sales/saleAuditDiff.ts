/**
 * Structured audit diff for sale edits (spec §2.3).
 *
 * Pure module: no I/O, no DB, no clocks. Safe to run anywhere (server post-tx,
 * unit specs). It only *describes* what changed — money/inventory semantics
 * still live in `computeSaleTotals` / `updateSale`.
 *
 * Matching: items pair by client `id` (the same `data.items[].id` that
 * `updateSale` discards as PK but keeps for parent linkage — existing rows
 * carry their DB id, new rows carry a fresh UUID). `swap` = same id but a
 * different product (FK tuple changed). Items without `id` can never pair:
 * re-created treatment children land as `add`/`del` (accepted, by design).
 *
 * Privacy: the mod comparison is an explicit field allowlist — internal costs
 * (`snapshotBaseCost/Mounting/Shipping/SalePrice`, `freeItemUnitCost`,
 * `shippingCostPending`, cost snapshots) are never read, hence never leak.
 */
import { DiscountType } from '$lib/shared/enums';
import { countSaleAuditChanges, MAX_SALE_AUDIT_CHANGES } from '$lib/schemas/sales';
import type { SaleAuditDiff } from '$lib/schemas/sales';
import type { SaleItemValueSource } from '$lib/shared/saleItemValues';

/** Anything with the item shape: a DB `SaleItem` row or a validated `SaleItemInput`. */
export interface SaleAuditItemLike extends SaleItemValueSource {
	id?: string | null;
	parentSaleItemId?: string | null;
}

export interface SaleAuditHeaderLike {
	saleDate?: string | null;
	notes?: string | null;
	isCashea?: boolean | null;
	discount?: number | null;
	discountType?: string | null;
}

export interface SaleAuditTotalsLike {
	subtotal: number;
	total: number;
}

export interface SaleAuditDiffContext {
	beforeHeader?: SaleAuditHeaderLike | null;
	afterHeader?: SaleAuditHeaderLike | null;
	beforeTotals?: SaleAuditTotalsLike | null;
	afterTotals?: SaleAuditTotalsLike | null;
	/** Label of the date row in DATOS (quotes reuse the diff: «Fecha»). */
	dateLabel?: string;
}

/** Re-exported for server callers (canonical home: `$lib/schemas/sales`). */
export { MAX_SALE_AUDIT_CHANGES, countSaleAuditChanges };

// ---------------------------------------------------------------------------
// Legible formatting (es-VE, deterministic, no Intl currency style surprises)
// ---------------------------------------------------------------------------

const decimal2 = new Intl.NumberFormat('es-VE', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/** `USD 1.234,50` — the canonical legible money form inside the diff. */
function fmtMoney(value: number): string {
	return `USD ${decimal2.format(value)}`;
}

/** Signed optical value: `+1.00` / `-1.75`. */
function fmtSigned(value: number): string {
	const sign = value < 0 ? '-' : '+';
	return `${sign}${Math.abs(value).toFixed(2)}`;
}

function fmtNum(value: number | null | undefined): string | null {
	if (value === null || value === undefined || !Number.isFinite(value)) return null;
	return fmtSigned(value);
}

// ---------------------------------------------------------------------------
// Item helpers
// ---------------------------------------------------------------------------

function itemName(item: SaleAuditItemLike): string {
	const snapshot = item.snapshotName?.trim();
	if (snapshot) return snapshot;
	const free = item.freeItemDescription?.trim();
	if (free) return free;
	switch (item.itemType) {
		case 'LENS_PAIR':
			return 'Cristales';
		case 'TREATMENT':
			return 'Tratamiento';
		case 'FREE_ITEM':
			return 'Artículo libre';
		default:
			return 'Producto';
	}
}

/** Line total with the same semantics as `computeSaleTotals` (gross − line discount). */
function lineTotal(item: SaleAuditItemLike): number {
	const gross = item.quantity * item.unitPrice;
	const discountAmount =
		item.discountType === DiscountType.PERCENTAGE
			? gross * (item.discount / 100)
			: (item.discount ?? 0);
	return Math.max(0, gross - discountAmount);
}

/**
 * Product identity: items pair by `id`; a paired item whose FK tuple changed
 * is a different product (`swap`). Treatment re-parenting also counts as swap.
 */
function itemIdentity(item: SaleAuditItemLike): string {
	return [
		item.itemType,
		item.productId ?? '',
		item.lensCatalogItemId ?? '',
		item.supplierTreatmentId ?? '',
		item.itemType === 'TREATMENT' ? (item.parentSaleItemId ?? '') : ''
	].join('|');
}

function fmtLineDiscount(item: SaleAuditItemLike): string | null {
	const value = item.discount ?? 0;
	if (value === 0) return null;
	if (item.discountType === DiscountType.PERCENTAGE) return `${value} %`;
	return fmtMoney(value);
}

/** `−1.00 −1.25 ×142°` from sphere/cylinder/axis; null when the eye is empty. */
function fmtEyeFormula(
	sphere: number | null | undefined,
	cylinder: number | null | undefined,
	axis: number | null | undefined
): string | null {
	const sph = fmtNum(sphere);
	const cyl = fmtNum(cylinder);
	const parts = [sph, cyl].filter((p): p is string => p !== null);
	if (parts.length === 0) return null;
	const axisSuffix = axis !== null && axis !== undefined ? ` ×${axis}°` : '';
	return `${parts.join(' ')}${axisSuffix}`;
}

function fmtMounting(item: SaleAuditItemLike): string | null {
	if (item.dp !== null && item.dp !== undefined) return `${item.dp}mm`;
	if (item.npRight !== null && item.npRight !== undefined) {
		if (item.npLeft !== null && item.npLeft !== undefined) {
			return `${item.npRight}/${item.npLeft}mm`;
		}
		return `${item.npRight}mm`;
	}
	return null;
}

interface ModField {
	key: string;
	label: string;
	from: string | null;
	to: string | null;
}

function normText(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/**
 * Field-by-field comparison for two paired items (same product).
 * Returns only the fields that changed, already legible. Cost fields are not
 * listed here at all (see module docstring).
 */
function diffItemFields(before: SaleAuditItemLike, after: SaleAuditItemLike): ModField[] {
	const fields: ModField[] = [];

	if (before.quantity !== after.quantity) {
		fields.push({
			key: 'quantity',
			label: 'Cantidad',
			from: String(before.quantity),
			to: String(after.quantity)
		});
	}
	if (before.unitPrice !== after.unitPrice) {
		fields.push({
			key: 'unitPrice',
			label: 'Precio unitario',
			from: fmtMoney(before.unitPrice),
			to: fmtMoney(after.unitPrice)
		});
	}
	const beforeDiscount = fmtLineDiscount(before);
	const afterDiscount = fmtLineDiscount(after);
	if (beforeDiscount !== afterDiscount) {
		fields.push({
			key: 'discount',
			label: 'Descuento de línea',
			from: beforeDiscount,
			to: afterDiscount
		});
	}

	const beforeFormulaOD = fmtEyeFormula(before.odSphere, before.odCylinder, before.odAxis);
	const afterFormulaOD = fmtEyeFormula(after.odSphere, after.odCylinder, after.odAxis);
	if (beforeFormulaOD !== afterFormulaOD) {
		fields.push({
			key: 'formulaOD',
			label: 'Fórmula OD',
			from: beforeFormulaOD,
			to: afterFormulaOD
		});
	}
	const beforeFormulaOS = fmtEyeFormula(before.osSphere, before.osCylinder, before.osAxis);
	const afterFormulaOS = fmtEyeFormula(after.osSphere, after.osCylinder, after.osAxis);
	if (beforeFormulaOS !== afterFormulaOS) {
		fields.push({
			key: 'formulaOS',
			label: 'Fórmula OI',
			from: beforeFormulaOS,
			to: afterFormulaOS
		});
	}

	for (const [key, label, b, a] of [
		['additionOD', 'Adición OD', before.odAddition, after.odAddition],
		['additionOS', 'Adición OI', before.osAddition, after.osAddition]
	] as const) {
		const from = fmtNum(b);
		const to = fmtNum(a);
		if (from !== to) fields.push({ key, label, from, to });
	}
	for (const [key, label, b, a] of [
		['alturaOD', 'Altura OD', before.odAltura, after.odAltura],
		['alturaOS', 'Altura OI', before.osAltura, after.osAltura]
	] as const) {
		const from = b ?? null;
		const to = a ?? null;
		if ((from ?? null) !== (to ?? null)) {
			fields.push({
				key,
				label,
				from: from === null ? null : `${from}mm`,
				to: to === null ? null : `${to}mm`
			});
		}
	}

	const beforeMounting = fmtMounting(before);
	const afterMounting = fmtMounting(after);
	if (beforeMounting !== afterMounting) {
		fields.push({
			key: 'mounting',
			label: 'Medidas de montaje',
			from: beforeMounting,
			to: afterMounting
		});
	}

	if (before.itemType === 'FREE_ITEM') {
		if (normText(before.freeItemCategory) !== normText(after.freeItemCategory)) {
			fields.push({
				key: 'freeItemCategory',
				label: 'Categoría libre',
				from: normText(before.freeItemCategory),
				to: normText(after.freeItemCategory)
			});
		}
		if (normText(before.freeItemDescription) !== normText(after.freeItemDescription)) {
			fields.push({
				key: 'freeItemDescription',
				label: 'Descripción',
				from: normText(before.freeItemDescription),
				to: normText(after.freeItemDescription)
			});
		}
		if (normText(before.freeItemOpticalNotes) !== normText(after.freeItemOpticalNotes)) {
			fields.push({
				key: 'freeItemOpticalNotes',
				label: 'Notas ópticas',
				from: normText(before.freeItemOpticalNotes),
				to: normText(after.freeItemOpticalNotes)
			});
		}
	}

	if (normText(before.notes) !== normText(after.notes)) {
		fields.push({
			key: 'notes',
			label: 'Notas del artículo',
			from: normText(before.notes),
			to: normText(after.notes)
		});
	}

	return fields;
}

// ---------------------------------------------------------------------------
// Header / totals
// ---------------------------------------------------------------------------

const dateTimeFmt = new Intl.DateTimeFormat('es-VE', {
	dateStyle: 'medium',
	timeStyle: 'short'
});

function fmtSaleDate(value: string | null | undefined): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return dateTimeFmt.format(date);
}

function fmtGlobalDiscount(
	value: number | null | undefined,
	type: string | null | undefined
): string | null {
	if (value === null || value === undefined || value === 0) return null;
	if (type === DiscountType.PERCENTAGE) return `${value} %`;
	return fmtMoney(value);
}

function diffHeaders(
	before: SaleAuditHeaderLike | null | undefined,
	after: SaleAuditHeaderLike | null | undefined,
	dateLabel = 'Fecha de venta'
): SaleAuditDiff['header'] {
	if (!before || !after) return [];
	const header: SaleAuditDiff['header'] = [];

	const beforeDate = fmtSaleDate(before.saleDate);
	const afterDate = fmtSaleDate(after.saleDate);
	if (beforeDate !== afterDate) {
		header.push({ key: 'saleDate', label: dateLabel, from: beforeDate, to: afterDate });
	}
	if (normText(before.notes) !== normText(after.notes)) {
		header.push({
			key: 'notes',
			label: 'Notas',
			from: normText(before.notes),
			to: normText(after.notes)
		});
	}
	if ((before.isCashea ?? false) !== (after.isCashea ?? false)) {
		header.push({
			key: 'isCashea',
			label: 'Cashea',
			from: before.isCashea ? 'Sí' : 'No',
			to: after.isCashea ? 'Sí' : 'No'
		});
	}
	const beforeDiscount = fmtGlobalDiscount(before.discount, before.discountType);
	const afterDiscount = fmtGlobalDiscount(after.discount, after.discountType);
	if (beforeDiscount !== afterDiscount) {
		header.push({
			key: 'discount',
			label: 'Descuento global',
			from: beforeDiscount,
			to: afterDiscount
		});
	}

	return header;
}

function diffTotals(
	before: SaleAuditTotalsLike | null | undefined,
	after: SaleAuditTotalsLike | null | undefined
): SaleAuditDiff['totals'] {
	if (!before || !after) return [];
	const totals: SaleAuditDiff['totals'] = [];
	if (before.subtotal !== after.subtotal) {
		totals.push({ label: 'Subtotal', from: before.subtotal, to: after.subtotal });
	}
	if (before.total !== after.total) {
		totals.push({ label: 'Total', from: before.total, to: after.total });
	}
	return totals;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build the v1 audit diff between the pre-edit items (`before`, DB rows read
 * in the tx) and the validated replacement (`after`, `data.items`).
 * Optional `context` carries the header/totals snapshots for the DATOS and
 * TOTALES sections. Output is capped at 50 atomic changes (`truncated`).
 */
export function buildSaleAuditDiff(
	before: SaleAuditItemLike[],
	after: SaleAuditItemLike[],
	context: SaleAuditDiffContext = {}
): SaleAuditDiff {
	const beforeById = new Map<string, SaleAuditItemLike>();
	const beforeWithoutId: SaleAuditItemLike[] = [];
	for (const item of before) {
		if (item.id) beforeById.set(item.id, item);
		else beforeWithoutId.push(item);
	}
	const afterById = new Map<string, SaleAuditItemLike>();
	const afterWithoutId: SaleAuditItemLike[] = [];
	for (const item of after) {
		if (item.id) afterById.set(item.id, item);
		else afterWithoutId.push(item);
	}

	const items: SaleAuditDiff['items'] = [];

	for (const item of afterWithoutId) {
		items.push({
			t: 'add',
			name: itemName(item),
			qty: item.quantity,
			total: lineTotal(item),
			unitPrice: item.unitPrice
		});
	}
	for (const item of beforeWithoutId) {
		items.push({
			t: 'del',
			name: itemName(item),
			qty: item.quantity,
			total: lineTotal(item),
			unitPrice: item.unitPrice
		});
	}

	for (const [id, afterItem] of afterById) {
		const beforeItem = beforeById.get(id);
		if (!beforeItem) {
			items.push({
				t: 'add',
				name: itemName(afterItem),
				qty: afterItem.quantity,
				total: lineTotal(afterItem),
				unitPrice: afterItem.unitPrice
			});
			continue;
		}
		if (itemIdentity(beforeItem) !== itemIdentity(afterItem)) {
			items.push({
				t: 'swap',
				from: { name: itemName(beforeItem), total: lineTotal(beforeItem) },
				to: { name: itemName(afterItem), total: lineTotal(afterItem) }
			});
			continue;
		}
		const fields = diffItemFields(beforeItem, afterItem);
		if (fields.length > 0) {
			items.push({ t: 'mod', name: itemName(afterItem), fields });
		}
	}
	for (const [id, beforeItem] of beforeById) {
		if (!afterById.has(id)) {
			items.push({
				t: 'del',
				name: itemName(beforeItem),
				qty: beforeItem.quantity,
				total: lineTotal(beforeItem),
				unitPrice: beforeItem.unitPrice
			});
		}
	}

	const header = diffHeaders(context.beforeHeader, context.afterHeader, context.dateLabel);
	const totals = diffTotals(context.beforeTotals, context.afterTotals);

	return capDiff({ v: 1, items, header, totals });
}

/** Enforce the 50-change cap (items → header → totals), counting mod fields atomically. */
function capDiff(diff: SaleAuditDiff): SaleAuditDiff {
	const total = countSaleAuditChanges(diff);
	if (total <= MAX_SALE_AUDIT_CHANGES) return diff;

	let budget = MAX_SALE_AUDIT_CHANGES;
	const items: SaleAuditDiff['items'] = [];
	for (const change of diff.items) {
		if (budget <= 0) break;
		if (change.t === 'mod') {
			const fields = change.fields.slice(0, budget);
			if (fields.length > 0) {
				items.push({ ...change, fields });
				budget -= fields.length;
			}
		} else {
			items.push(change);
			budget -= 1;
		}
	}
	const header: SaleAuditDiff['header'] = [];
	for (const row of diff.header) {
		if (budget <= 0) break;
		header.push(row);
		budget -= 1;
	}
	const totals: SaleAuditDiff['totals'] = [];
	for (const row of diff.totals) {
		if (budget <= 0) break;
		totals.push(row);
		budget -= 1;
	}
	return { ...diff, items, header, totals, truncated: total - MAX_SALE_AUDIT_CHANGES };
}
