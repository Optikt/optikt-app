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
import { sales, saleItems, products, lensCatalogItems } from '$lib/server/db/schema';
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
	clearSaleItemPrescriptions,
	findSaleGroupableItems,
	findSaleItemGroups,
	lockSaleForGroups
} from '$lib/server/db/queries/sales/itemGroups';
import { patchSalePrescriptionMeasures } from '$lib/server/sales/primaryPrescription';
import {
	groupsAuditChanges,
	persistSaleGroups,
	type PersistSaleGroupsResult
} from '$lib/server/sales/saleItemGroupsCore';
import { remapGroupItemIds, validateItemGroups } from '$lib/shared/saleItemGroups';
import type { ActionContext } from '$lib/server/actionContext';

class SaleUpdateError extends Error {}

function editableSaleError(status: string, isAdmin: boolean): string | null {
	if (status === SaleStatus.CANCELLED) return 'No se puede modificar una venta cancelada';
	if (status === SaleStatus.COMPLETED) return 'No se puede modificar una venta completada';
	if ((status === SaleStatus.IN_PROGRESS || status === SaleStatus.READY) && !isAdmin) {
		return 'Solo administradores pueden modificar ventas en progreso o listas para retirar';
	}
	return null;
}

/**
 * Edit an existing sale (header and/or full item replacement with EDIT_REVERT + SALE_OUT).
 * COMPLETED blocked; IN_PROGRESS/READY admin-only; PENDING authorized users.
 */
export async function updateSaleCore(data: UpdateSaleInput, ctx: ActionContext) {
	const existing = await findSaleById(data.id);
	if (!existing) return { success: false as const, error: 'Venta no encontrada' };

	if (!canManageSaleByOwner(ctx.role, ctx.userId, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	const isAdmin = ctx.role === UserRole.ADMIN || ctx.role === UserRole.MANAGER;
	const statusErr = editableSaleError(existing.status, isAdmin);
	if (statusErr) return { success: false as const, error: statusErr };

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
		if (existingOrder && existingOrder.id !== data.id) {
			return { success: false as const, error: `El número de orden #${newOrderNumber} ya existe` };
		}
	}

	// Validate customer reference if changed
	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) return { success: false as const, error: 'Cliente no encontrado' };
	}

	const hasItemChanges = !!data.items && data.items.length > 0;
	if (data.items && data.items.length === 0) {
		return { success: false as const, error: 'La venta debe tener al menos un artículo' };
	}

	// Per-person groups + primary lens before the change (read inside the locked tx).
	const touchesGroups = data.groups !== undefined || data.primaryLensItemId !== undefined;

	// Treatments must belong to the same supplier as their parent lens (same rule
	// as createSale). Also validate explicit groups/primary on item edits.
	if (hasItemChanges) {
		const treatmentError = await validateTreatmentItems(data.items!);
		if (treatmentError) return { success: false as const, error: treatmentError.error };
		if (touchesGroups) {
			const incoming = data
				.items!.filter((i): i is typeof i & { id: string } => !!i.id)
				.map((i) => ({ id: i.id, itemType: i.itemType, quantity: i.quantity }));
			const errs = validateItemGroups(data.groups ?? [], incoming, data.primaryLensItemId);
			if (errs.length > 0) return { success: false as const, error: errs[0] };
		}
	}

	// Prescription measures (DP / nasal) patch: pre-validate unless this edit
	// itself sets a primary lens (which creates a fresh prescription in the tx).
	let prescriptionBefore: Prescription | null = null;
	if (data.prescription) {
		prescriptionBefore = await getSalePrescription(data.id);
		const customerChangedPre = !!data.customerId && data.customerId !== existing.customerId;
		const effectivePrimary =
			data.primaryLensItemId !== undefined ? data.primaryLensItemId : existing.primaryLensItemId;
		const createsPrimaryRx =
			(!!effectivePrimary && effectivePrimary !== existing.primaryLensItemId) ||
			(customerChangedPre && !!effectivePrimary);
		if (!prescriptionBefore && !createsPrimaryRx) {
			return {
				success: false as const,
				error:
					'No se pueden guardar las medidas: esta venta no tiene una receta asociada. Edita la graduación del cristal.'
			};
		}
	}

	let beforeSale = existing;
	let newSubtotal = existing.subtotal;
	let newTotal = existing.total;
	let beforeGroups: Awaited<ReturnType<typeof findSaleItemGroups>> = [];
	let logicalBeforeGroups:
		Awaited<ReturnType<typeof findSaleItemGroups>> | ReturnType<typeof remapGroupItemIds> = [];
	let beforeLines: Awaited<ReturnType<typeof findSaleGroupableItems>> = [];
	let groupsResult = null as PersistSaleGroupsResult | null;
	let beforePrimaryUsed: string | null = existing.primaryLensItemId;
	let logicalBeforePrimary: string | null = existing.primaryLensItemId;

	// All writes in a single transaction
	const beforeItems: SaleItem[] = [];
	let txResult: { sale: typeof existing | undefined; prescription: Prescription | null };
	try {
		// A race on the reassigned number surfaces as the same friendly duplicate error
		txResult = await db
			.transaction(async (tx) => {
				// Same lock order as createSaleCore (sequence lock → sale row → inventory rows).
				if (newOrderNumber !== undefined) await lockSaleOrderSequence(tx);
				const lockedSale = await lockSaleForGroups(data.id, tx);
				if (!lockedSale) throw new SaleUpdateError('Venta no encontrada');
				const lockedErr = editableSaleError(lockedSale.status, isAdmin);
				if (lockedErr) throw new SaleUpdateError(lockedErr);
				const freshSale = await findSaleById(data.id, {}, tx);
				if (!freshSale) throw new SaleUpdateError('Venta no encontrada');
				beforeSale = freshSale;

				// Compute totals & payment protection from the locked row (never stale pre-lock totals).
				const newDiscount = data.discount ?? freshSale.discount;
				const newDiscountType = data.discountType ?? freshSale.discountType;
				const taxRate = data.snapshotTaxRate ?? freshSale.snapshotTaxRate;
				if (hasItemChanges) {
					const totals = computeSaleTotals(
						data.items!.map((item) => toSaleTotalsLine(item, taxRate)),
						newDiscount,
						newDiscountType
					);
					newSubtotal = totals.subtotal;
					newTotal = totals.total;
				} else {
					newSubtotal = freshSale.subtotal;
					newTotal = Math.max(
						0,
						newSubtotal - computeDiscount(newDiscount, newDiscountType, newSubtotal)
					);
				}
				if (newTotal < freshSale.paidAmountBcvUsd - 0.01) {
					throw new SaleUpdateError(
						'La modificación reduce el total por debajo de lo ya cobrado. Por favor cancele esta venta y cree una nueva.'
					);
				}

				const customerIdAfter = data.customerId ?? freshSale.customerId;
				const customerChanged = customerIdAfter !== freshSale.customerId;
				const needsGroupWork = hasItemChanges || touchesGroups || customerChanged;
				const lockedPrimary = freshSale.primaryLensItemId;
				beforePrimaryUsed = lockedPrimary;
				logicalBeforePrimary = lockedPrimary;

				if (needsGroupWork) {
					[beforeGroups, beforeLines] = await Promise.all([
						findSaleItemGroups(data.id, tx),
						findSaleGroupableItems(data.id, tx)
					]);
					logicalBeforeGroups = beforeGroups;
					// Header-only edits send real ids: verify against locked live lines before saving.
					if (!hasItemChanges && touchesGroups) {
						const errors = validateItemGroups(
							data.groups ?? beforeGroups,
							beforeLines,
							data.primaryLensItemId
						);
						if (errors.length > 0) throw new SaleUpdateError(errors[0]);
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

					// ── 4. Insert new items + consume inventory (parents before child treatments) ──
					const idMap = new Map<string, string>();
					const indexedItems = data.items!.map((item) => {
						const saleItemId = crypto.randomUUID();
						if (item.id) idMap.set(item.id, saleItemId);
						return { item, saleItemId };
					});
					const orderedItems = [
						...indexedItems.filter((e) => !e.item.parentSaleItemId),
						...indexedItems.filter((e) => !!e.item.parentSaleItemId)
					];
					for (const { item, saleItemId } of orderedItems) {
						const resolvedParentId = item.parentSaleItemId
							? (idMap.get(item.parentSaleItemId) ?? null)
							: null;

						await insertSaleItem(tx, {
							id: saleItemId,
							saleId: data.id,
							item,
							parentSaleItemId: resolvedParentId,
							prescriptionId: customerChanged ? null : (item.prescriptionId ?? null),
							userId: ctx.userId!,
							now: nowISO()
						});
					}

					// ── 4b. Groups + primary lens follow the replaced items ─────────
					const remapId = (id: string | null | undefined) => (id ? (idMap.get(id) ?? null) : null);
					const previousPrimary = remapId(lockedPrimary);
					logicalBeforeGroups = remapGroupItemIds(beforeGroups, idMap);
					// Keep the old id when item replacement deleted the primary line so audit logs X → Ninguna.
					logicalBeforePrimary = previousPrimary ?? lockedPrimary;
					groupsResult = await persistSaleGroups(tx, {
						saleId: data.id,
						customerId: customerIdAfter,
						groups: remapGroupItemIds(data.groups ?? beforeGroups, idMap),
						primaryLensItemId:
							data.primaryLensItemId !== undefined
								? remapId(data.primaryLensItemId)
								: previousPrimary,
						previousPrimaryLensItemId: previousPrimary,
						previousPrimaryRx: beforeLines.find((l) => l.id === lockedPrimary),
						customerChanged,
						measures: data.prescription
					});

					// DP/NP measures: if persistSaleGroups created a fresh Rx they were
					// already merged; otherwise patch the existing linked Rx (same customer).
					const patchedPrescription =
						data.prescription && !groupsResult.prescription
							? await patchSalePrescriptionMeasures(tx, data.id, customerIdAfter, data.prescription)
							: null;

					// ── 5. Update sale header ───────────────────────────────────────
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
					if (newOrderNumber !== undefined) await bumpSaleOrderSequence(newOrderNumber, tx);
					return { sale: updated, prescription: patchedPrescription };
				}

				// Header-only update (no item changes)
				if (touchesGroups || (customerChanged && lockedPrimary)) {
					groupsResult = await persistSaleGroups(tx, {
						saleId: data.id,
						customerId: customerIdAfter,
						groups: data.groups,
						primaryLensItemId:
							data.primaryLensItemId !== undefined
								? data.primaryLensItemId
								: customerChanged
									? lockedPrimary
									: undefined,
						previousPrimaryLensItemId: lockedPrimary,
						customerChanged,
						measures: data.prescription
					});
				} else if (customerChanged) {
					// Even without a primary lens, sever any legacy Rx links to the previous customer.
					await clearSaleItemPrescriptions(data.id, tx);
				}

				const patchedPrescription =
					data.prescription && !groupsResult?.prescription
						? await patchSalePrescriptionMeasures(tx, data.id, customerIdAfter, data.prescription)
						: null;

				const headerUpdate: Record<string, unknown> = {};
				if (data.customerId) headerUpdate.customerId = data.customerId;
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

				// A no-op save (reason only) must not bump `updatedAt` on the sale row.
				if (Object.keys(headerUpdate).length === 0) {
					const saleOut =
						groupsResult?.primaryLensItemId !== undefined
							? { ...freshSale, primaryLensItemId: groupsResult.primaryLensItemId }
							: freshSale;
					return { sale: saleOut, prescription: patchedPrescription };
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
	} catch (err) {
		if (err instanceof SaleUpdateError) {
			return { success: false as const, error: err.message };
		}
		throw err;
	}

	const updatedSale = txResult.sale;
	if (groupsResult?.prescription) {
		await auditService.logCreate(
			'prescription',
			groupsResult.prescription,
			{ ...ctx, reason: data.reason },
			{ excludeFields: ['createdAt', 'updatedAt', 'deletedAt'] }
		);
	}
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

	// Audit (best-effort, after transaction succeeds) against the locked pre-edit snapshot.
	const headerChanges = calculateDiff(beforeSale, updatedSale, [
		'updatedAt',
		'deletedAt',
		'primaryLensItemId'
	]);
	const needsDiff = hasItemChanges || hasChanges(headerChanges);
	let itemsDiff: { old: null; new: ReturnType<typeof buildSaleAuditDiff> } | null = null;
	if (needsDiff) {
		const diffContext: SaleAuditDiffContext = {
			beforeHeader: {
				saleDate: beforeSale.createdAt,
				notes: beforeSale.notes,
				isCashea: beforeSale.isCashea,
				discount: beforeSale.discount,
				discountType: beforeSale.discountType
			},
			afterHeader: {
				saleDate: data.saleDate ?? beforeSale.createdAt,
				notes: data.notes ?? beforeSale.notes,
				isCashea: data.isCashea ?? beforeSale.isCashea,
				discount: data.discount ?? beforeSale.discount,
				discountType: data.discountType ?? beforeSale.discountType
			},
			beforeTotals: { subtotal: beforeSale.subtotal, total: beforeSale.total },
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
				logicalBefore: logicalBeforeGroups,
				after: groupsResult.groups,
				beforePrimary: beforePrimaryUsed,
				logicalBeforePrimary,
				afterPrimary: groupsResult.primaryLensItemId,
				nameOf: (id) => lineNames.get(id) ?? 'Artículo'
			})
		: {};
	const auditChanges = { ...headerChanges, ...groupChanges };
	if (itemsDiff && countSaleAuditChanges(itemsDiff.new) > 0) {
		auditChanges.itemsDiff = itemsDiff;
	}
	if (hasChanges(auditChanges)) {
		await auditService.logCustom('sale', data.id, 'update', auditChanges, {
			...ctx,
			reason: data.reason
		});
	}

	return { success: true as const, sale: updatedSale };
}
