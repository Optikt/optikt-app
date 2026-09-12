/**
 * Lenses remote — materials
 * Split from lenses.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { query, form, command } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';
import { invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { softDelete } from '$lib/server/db/queries/deletedItems';

import {
	CreateLensMaterialSchema,
	UpdateLensMaterialSchema,
	LensIdSchema
} from '$lib/schemas/lenses';

import {
	getAllLensMaterials,
	findLensMaterialById,
	findLensMaterialByName,
	findLensMaterialByCode,
	createLensMaterial,
	updateLensMaterial
} from '$lib/server/db/queries/lenses';

import type { LensMaterial } from '$lib/server/db/schema';

import { auditService, getAuditContext } from '$lib/server/audit';

// LENS MATERIALS
// ============================================================================

export const listLensMaterials = query('unchecked', async (): Promise<LensMaterial[]> => {
	requireAuth();

	return getAllLensMaterials();
});

export const createLensMaterialForm = form(
	CreateLensMaterialSchema,
	async (data, issue): Promise<LensMaterial> => {
		requireAdmin();

		// Check for duplicate name
		const existingName = await findLensMaterialByName(data.name);
		if (existingName) {
			invalid(issue.name('Ya existe un material con este nombre'));
		}

		// Check for duplicate code
		const existingCode = await findLensMaterialByCode(data.code);
		if (existingCode) {
			invalid(issue.code('Ya existe un material con este código'));
		}

		const material = await createLensMaterial(data);
		await auditService.logCreate('lens_material', material, getAuditContext());
		return material;
	}
);

export const updateLensMaterialForm = form(
	UpdateLensMaterialSchema,
	async (data, issue): Promise<LensMaterial> => {
		requireAdmin();

		const { id, ...updates } = data;

		const existing = await findLensMaterialById(id);
		if (!existing) {
			invalid('Material no encontrado');
		}

		// Check duplicate name if changing
		if (updates.name && updates.name !== existing.name) {
			const dup = await findLensMaterialByName(updates.name);
			if (dup) invalid(issue.name('Ya existe un material con este nombre'));
		}

		// Check duplicate code if changing
		if (updates.code && updates.code !== existing.code) {
			const dup = await findLensMaterialByCode(updates.code);
			if (dup) invalid(issue.code('Ya existe un material con este código'));
		}

		const updated = await updateLensMaterial(id, updates);
		if (!updated) invalid('Error actualizando material');
		await auditService.logUpdate('lens_material', id, existing, updated, getAuditContext());
		return updated;
	}
);

export const deleteLensMaterialById = command(LensIdSchema, async (data): Promise<void> => {
	requireAdmin();

	const existing = await findLensMaterialById(data.id);
	if (!existing) throw new Error('Material no encontrado');

	await db.transaction(async (tx) => {
		const ok = await softDelete('lens_material', data.id, getAuditContext().userId ?? null, tx);
		if (!ok) throw new Error('Error eliminando material');
	});

	await auditService.logDelete('lens_material', existing, getAuditContext());
});
