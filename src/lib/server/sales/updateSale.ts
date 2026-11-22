import { toSaleTotalsLine } from '$lib/shared/saleTotals';
import { findSaleById, getSalePrescription } from '$lib/server/db/queries/sales/reads';
import {
	bumpSaleOrderSequence,
	isDuplicateOrderNumberError,
	lockSaleOrderSequence
} from '$lib/server/db/queries/sales/writes';
import type { Prescription, SaleItem } from '$lib/server/db/schema';
import { findCustomerById } from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import { sales, saleItems, products, lensCatalogItems, prescriptions } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { SaleStatus, UserRole, canManageSaleByOwner } from '$lib/shared/enums';
import { computeDiscount } from '$lib/utils';
import { auditService } from '$lib/server/audit';
import { calculateDiff, hasChanges } from '$lib/server/audit/utils';
import {
	buildSaleAuditDiff,
	countSaleAuditChanges,
	type SaleAuditDiffContext
} from '$lib/server/sales/saleAuditDiff';
import { revertSaleInventory } from '$lib/server/sales/revertSaleInventory';
import { nowISO } from '$lib/dates';
import { insertSaleItem } from '$lib/server/sales/saleItemInsert';
import { validateTreatmentItems } from '$lib/server/treatmentValidation';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import type { UpdateSaleInput } from '$lib/schemas/sales';
import {
	findSaleGroupableItems,
	findSaleItemGroups
} from '$lib/server/db/queries/sales/itemGroups';
import {
	groupsAuditChanges,
	persistSaleGroups,
	type PersistSaleGroupsResult
} from '$lib/server/sales/saleItemGroupsCore';
import { remapGroupItemIds, validateItemGroups } from '$lib/shared/saleItemGroups';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Edit an existing sale: update header fields and/or replace items.
 *
 * Strict state/role enforcement:
 * - COMPLETED: blocked entirely.
 * - IN_PROGRESS / READY: only ADMIN/MANAGER may edit.
 * - PENDING: allowed for authorized users.
 *
 * When items change the full inventory is reset (EDIT_REVERT) and
 * re-consumed (SALE_OUT) inside the same transaction.
 */
export async function updateSaleCore(data: UpdateSaleInput, ctx: ActionContext) {
	// Read validation (outside transaction)
	const existing = await findSaleById(data.id);
	if (!existing) return { success: false as const, error: 'Venta no encontrada' };
	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se puede modificar una venta cancelada' };
	}

	if (!canManageSaleByOwner(ctx.role, ctx.userId, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	if (existing.status === SaleStatus.COMPLETED) {
		return { success: false as const, error: 'No se puede modificar una venta completada' };
	}

	const isAdmin = ctx.role === UserRole.ADMIN || ctx.role === UserRole.MANAGER;
	if (
		(existing.status === SaleStatus.IN_PROGRESS || existing.status === SaleStatus.READY) &&
		!isAdmin
	) {
		return {
			success: false as const,
			error: 'Solo administradores pueden modificar ventas en progreso o listas para retirar'
		};
	}

	// Order number reassignment: admin only (code-only for now, no UI field yet).
	if (data.orderNumber && !isAdmin) {
		return {
			success: false as const,
			error: 'Solo administradores pueden cambiar el número de orden'
		};
	}

	// Resending the sale's own number is not a reassignment (no lock, no write, no audit)
	const newOrderNumber =
		data.orderNumber !== undefined && data.orderNumber !== existing.orderNumber
			? data.orderNumber
			: undefined;

	if (newOrderNumber !== undefined) {
		const [existingOrder] = await db
			.select({ id: sales.id })
			.from(sales)
			.where(eq(sales.orderNumber, newOrderNumber));
		// Reassigning a sale its own number is a no-op, not a duplicate
		if (existingOrder && existingOrder.id !== data.id) {
			return {
				success: false as const,
				error: `El número de orden #${newOrderNumber} ya existe`
			};
		}
	}

	// Payment protection
	const paidAmount = existing.paidAmountBcvUsd;

	// Validate customer reference if changed
	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) return { success: false as const, error: 'Cliente no encontrado' };
	}

	// Calculate new totals
	const hasItemChanges = !!data.items && data.items.length > 0;
	if (data.items && data.items.length === 0) {
		return { success: false as const, error: 'La venta debe tener al menos un artículo' };
	}

	// Treatments must belong to the same supplier as their parent lens (same rule
	// as createSale). This keeps edited sales consistent when the lens changes.
	if (hasItemChanges) {
		const treatmentError = await validateTreatmentItems(data.items!);
		if (treatmentError) {
			return { success: false as const, error: treatmentError.error };
		}
	}

	let newSubtotal = existing.subtotal;

	const newDiscount = data.discount ?? existing.discount;
	const newDiscountType = data.discountType ?? existing.discountType;

	let newTotal = Math.max(
		0,
		newSubtotal - computeDiscount(newDiscount, newDiscountType, newSubtotal)
	);

	if (hasItemChanges) {
		const totals = computeSaleTotals(
			data.items!.map((item) =>
				toSaleTotalsLine(item, data.snapshotTaxRate ?? existing.snapshotTaxRate)
			),
			newDiscount,
			newDiscountType
		);
		newSubtotal = totals.subtotal;
		newTotal = totals.total;
	}

	if (newTotal < paidAmount - 0.01) {
		return {
			success: false as const,
			error:
				'La modificación reduce el total por debajo de lo ya cobrado. Por favor cancele esta venta y cree una nueva.'
		};
	}

	// Prescription measures (DP / nasal) patch. The target row is resolved once
	// (before the transaction) as pre-validation — a sale without a prescription
	// row must NOT silently drop the patch. The same `getSalePrescription` join
	// (inner → prescriptionId IS NOT NULL, ordered like the sale detail read)
	// picks the row both here and in the resolver below.
	let prescriptionBefore: Prescription | null = null;
	if (data.prescription) {
		prescriptionBefore = await getSalePrescription(data.id);
		if (!prescriptionBefore) {
			return {
				success: false as const,
				error:
					'No se pueden guardar las medidas: esta venta no tiene una receta asociada. Edita la graduación del cristal.'
			};
		}
	}

	// Per-person groups + primary lens before the change (audit + remap source).
	const beforeGroups = await findSaleItemGroups(data.id);
	const beforeLines = await findSaleGroupableItems(data.id);
	const touchesGroups = data.groups !== undefined || data.primaryLensItemId !== undefined;
	const customerIdAfter = data.customerId ?? existing.customerId;
	const customerChanged = customerIdAfter !== existing.customerId;
	// Item edits are validated by the schema (client ids). A header-only edit
	// sends real ids: check them here, never clamp a bad primary to null.
	if (!hasItemChanges && touchesGroups) {
		const errors = validateItemGroups(
			data.groups ?? beforeGroups,
			beforeLines,
			data.primaryLensItemId
		);
		if (errors.length > 0) return { success: false as const, error: errors[0] };
	}
	let groupsResult = null as PersistSaleGroupsResult | null;

	// All writes in a single transaction
	const beforeItems: SaleItem[] = [];
	// A race on the reassigned number surfaces as the same friendly duplicate error
	const txResult = await db
		.transaction(async (tx) => {
			// Same lock order as createSaleCore (sequence lock → inventory rows): a
			// number reassignment must take it before touching lots, or deadlock.
			if (newOrderNumber !== undefined) await lockSaleOrderSequence(tx);
			let patchedPrescription: Prescription | null = null;
			if (data.prescription) {
				const prescId = (await getSalePrescription(data.id, tx))?.id;
				if (prescId) {
					const patch: Record<string, unknown> = { updatedAt: nowISO() };
					for (const key of ['dp', 'npRight', 'npLeft'] as const) {
						const value = data.prescription[key];
						if (value !== undefined) patch[key] = value;
					}
					const [after] = await tx
						.update(prescriptions)
						.set(patch)
						.where(eq(prescriptions.id, prescId))
						.returning();
					patchedPrescription = after ?? null;
				}
			}

			if (hasItemChanges) {
				// ── 1. Return only what the sale still holds (net outstanding per
				// lot — never re-returns movements a prior edit already reverted) ──
				await revertSaleInventory(tx, data.id, ctx.userId!, {
					origin: 'edit',
					reason: data.reason
				});

				// ── 2. Restore cached stock counters ────────────────────────────
				const oldItems = await tx
					.select()
					.from(saleItems)
					.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

				// Snapshot for the post-tx audit diff (read before the soft-delete below).
				beforeItems.push(...oldItems);

				for (const item of oldItems) {
					if (item.productId) {
						const [product] = await tx
							.select({ id: products.id, stock: products.stock })
							.from(products)
							.where(eq(products.id, item.productId));

						if (product && product.stock !== null) {
							await tx
								.update(products)
								.set({ stock: product.stock + item.quantity, updatedAt: nowISO() })
								.where(eq(products.id, item.productId));
						}
					}

					if (item.lensCatalogItemId) {
						const [lens] = await tx
							.select({
								id: lensCatalogItems.id,
								stock: lensCatalogItems.stock,
								inventoryMode: lensCatalogItems.inventoryMode
							})
							.from(lensCatalogItems)
							.where(eq(lensCatalogItems.id, item.lensCatalogItemId));

						if (lens && lens.inventoryMode === 'STOCK' && lens.stock !== null) {
							await tx
								.update(lensCatalogItems)
								.set({ stock: lens.stock + item.quantity, updatedAt: nowISO() })
								.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
						}
					}
				}

				// ── 3. Soft-delete all existing sale items (cascade handles free_details + child treatments) ──
				await tx
					.update(saleItems)
					.set({ deletedAt: nowISO(), updatedAt: nowISO() })
					.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

				// ── 4. Insert new items + consume inventory ──────────────────────
				const idMap = new Map<string, string>();
				const newIds = new Map<number, string>();
				data.items!.forEach((item, index) => {
					const newId = crypto.randomUUID();
					newIds.set(index, newId);
					if (item.id) idMap.set(item.id, newId);
				});
				for (const [index, item] of data.items!.entries()) {
					const saleItemId = newIds.get(index)!;
					const resolvedParentId = item.parentSaleItemId
						? (idMap.get(item.parentSaleItemId) ?? null)
						: null;

					await insertSaleItem(tx, {
						id: saleItemId,
						saleId: data.id,
						item,
						parentSaleItemId: resolvedParentId,
						prescriptionId: item.prescriptionId ?? null,
						userId: ctx.userId!,
						now: nowISO()
					});
				}

				// ── 4b. Groups + primary lens follow the replaced items ─────────
				// Items got new ids: translate (client id → new id) the incoming
				// groups, or the current ones when the payload doesn't send groups.
				const remapId = (id: string | null | undefined) => (id ? (idMap.get(id) ?? null) : null);
				const previousPrimary = remapId(existing.primaryLensItemId);
				groupsResult = await persistSaleGroups(tx, {
					saleId: data.id,
					customerId: customerIdAfter,
					groups: remapGroupItemIds(data.groups ?? beforeGroups, idMap),
					primaryLensItemId:
						data.primaryLensItemId !== undefined
							? remapId(data.primaryLensItemId)
							: previousPrimary,
					previousPrimaryLensItemId: previousPrimary,
					previousPrimaryRx: beforeLines.find((l) => l.id === existing.primaryLensItemId),
					customerChanged
				});

				// ── 5. Recalculate tax snapshot if provided ─────────────────────
				const taxRate = data.snapshotTaxRate ?? existing.snapshotTaxRate;
				const updateData: Record<string, unknown> = {
					subtotal: newSubtotal,
					total: newTotal,
					snapshotTaxRate: taxRate,
					updatedAt: nowISO()
				};

				if (data.customerId) updateData.customerId = data.customerId;
				/** saleDate alias → createdAt (modal already composes day + preserved time) */
				if (data.saleDate) updateData.createdAt = data.saleDate;
				if (data.notes !== undefined) updateData.notes = data.notes;
				if (data.discount !== undefined) updateData.discount = data.discount;
				if (data.discountType !== undefined) updateData.discountType = data.discountType;
				if (data.isCashea !== undefined) updateData.isCashea = data.isCashea;
				if (newOrderNumber !== undefined) updateData.orderNumber = newOrderNumber;

				const [updated] = await tx
					.update(sales)
					.set(updateData)
					.where(eq(sales.id, data.id))
					.returning();
				// Reassigned number ahead of the sequence → the next automatic sale is N+1
				if (newOrderNumber !== undefined) await bumpSaleOrderSequence(newOrderNumber, tx);

				return { sale: updated, prescription: patchedPrescription };
			}

			// ── Header-only update (no item changes) ───────────────────────────
			if (touchesGroups || (customerChanged && existing.primaryLensItemId)) {
				groupsResult = await persistSaleGroups(tx, {
					saleId: data.id,
					customerId: customerIdAfter,
					groups: data.groups,
					primaryLensItemId:
						data.primaryLensItemId !== undefined
							? data.primaryLensItemId
							: customerChanged
								? existing.primaryLensItemId
								: undefined,
					previousPrimaryLensItemId: existing.primaryLensItemId,
					customerChanged
				});
			}

			const headerUpdate: Record<string, unknown> = {};
			if (data.customerId) headerUpdate.customerId = data.customerId;
			/** saleDate alias → createdAt (modal already composes day + preserved time) */
			if (data.saleDate) headerUpdate.createdAt = data.saleDate;
			if (data.notes !== undefined) headerUpdate.notes = data.notes;
			if (data.discount !== undefined) headerUpdate.discount = data.discount;
			if (data.discountType !== undefined) headerUpdate.discountType = data.discountType;
			if (data.snapshotTaxRate !== undefined) headerUpdate.snapshotTaxRate = data.snapshotTaxRate;
			if (data.isCashea !== undefined) headerUpdate.isCashea = data.isCashea;
			if (newOrderNumber !== undefined) headerUpdate.orderNumber = newOrderNumber;

			if (data.discount !== undefined || data.discountType !== undefined) {
				headerUpdate.subtotal = newSubtotal;
				headerUpdate.total = newTotal;
			}

			// A no-op save (reason only) must not touch the sale row at all:
			// `updatedAt` only bumps when a real field changes.
			if (Object.keys(headerUpdate).length === 0) {
				return { sale: existing, prescription: patchedPrescription };
			}
			headerUpdate.updatedAt = nowISO();

			const [updated] = await tx
				.update(sales)
				.set(headerUpdate)
				.where(eq(sales.id, data.id))
				.returning();
			if (newOrderNumber !== undefined) await bumpSaleOrderSequence(newOrderNumber, tx);

			return { sale: updated, prescription: patchedPrescription };
		})
		.catch((err: unknown) => {
			if (newOrderNumber !== undefined && isDuplicateOrderNumberError(err)) {
				throw new Error(`El número de orden #${newOrderNumber} ya existe`, { cause: err });
			}
			throw err;
		});

	const updatedSale = txResult.sale;

	// New current prescription from the primary lens (best-effort audit).
	if (groupsResult?.prescription) {
		await auditService.logCreate('prescription', groupsResult.prescription, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	// Prescription audit (best-effort, after transaction succeeds): the DP/NP patch
	// does NOT land on the sale row, so the sale logUpdate above would never show it.
	if (txResult.prescription && prescriptionBefore) {
		await auditService.logUpdate(
			'prescription',
			txResult.prescription.id,
			prescriptionBefore,
			txResult.prescription,
			{ ...ctx, reason: data.reason },
			{ excludeFields: ['updatedAt', 'createdAt', 'deletedAt'] }
		);
	}

	if (!updatedSale) {
		return { success: false as const, error: 'Error al actualizar la venta' };
	}

	// Audit (best-effort, after transaction succeeds). The structured items
	// diff is computed pure here and annexed as `changes.itemsDiff` on the same
	// «Venta actualizada» event — the inventory tx above is never touched.
	const headerChanges = calculateDiff(existing, updatedSale, ['updatedAt', 'deletedAt']);
	const needsDiff = hasItemChanges || hasChanges(headerChanges);
	let itemsDiff: { old: null; new: ReturnType<typeof buildSaleAuditDiff> } | null = null;
	if (needsDiff) {
		const diffContext: SaleAuditDiffContext = {
			beforeHeader: {
				saleDate: existing.createdAt,
				notes: existing.notes,
				isCashea: existing.isCashea,
				discount: existing.discount,
				discountType: existing.discountType
			},
			afterHeader: {
				saleDate: data.saleDate ?? existing.createdAt,
				notes: data.notes ?? existing.notes,
				isCashea: data.isCashea ?? existing.isCashea,
				discount: data.discount ?? existing.discount,
				discountType: data.discountType ?? existing.discountType
			},
			beforeTotals: { subtotal: existing.subtotal, total: existing.total },
			afterTotals: { subtotal: newSubtotal, total: newTotal }
		};
		const diff = buildSaleAuditDiff(
			hasItemChanges ? beforeItems : [],
			hasItemChanges ? (data.items ?? []) : [],
			diffContext
		);
		itemsDiff = { old: null, new: diff };
	}
	const lineNames = new Map(
		[...beforeLines, ...(groupsResult?.lines ?? [])].map((l) => [
			l.id,
			l.snapshotName ?? 'Artículo'
		])
	);
	const groupChanges = groupsResult
		? groupsAuditChanges({
				before: beforeGroups,
				after: groupsResult.groups,
				beforePrimary: existing.primaryLensItemId,
				afterPrimary: groupsResult.primaryLensItemId,
				nameOf: (id) => lineNames.get(id) ?? 'Artículo'
			})
		: {};
	// Item replacement alone changes the line ids; compare by readable summary only.
	delete headerChanges.primaryLensItemId;
	if (
		hasChanges(headerChanges) ||
		hasChanges(groupChanges) ||
		(itemsDiff && countSaleAuditChanges(itemsDiff.new) > 0)
	) {
		await auditService.logCustom(
			'sale',
			data.id,
			'update',
			{ ...headerChanges, ...groupChanges, ...(itemsDiff ? { itemsDiff } : {}) },
			{ ...ctx, reason: data.reason }
		);
	}

	return { success: true as const, sale: updatedSale };
}
