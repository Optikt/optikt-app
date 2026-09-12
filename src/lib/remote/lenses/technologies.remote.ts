/**
 * Lenses remote — technologies + differentiators
 * Split from lenses.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { query, form, command } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';
import { invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { softDelete } from '$lib/server/db/queries/deletedItems';

import {
	CreateLensTechnologySchema,
	UpdateLensTechnologySchema,
	LensIdSchema,
	LensSupplierIdSchema,
	ListTechnologiesSchema,
	RenameDifferentiatorSchema,
	DeleteDifferentiatorSchema
} from '$lib/schemas/lenses';

import {
	getTechnologiesBySupplier,
	findLensTechnologyById,
	createLensTechnology,
	updateLensTechnology,
	getAllTechnologies,
	getAllDifferentiators,
	renameDifferentiator,
	deleteDifferentiator
} from '$lib/server/db/queries/lenses';

import type { LensTechnology } from '$lib/server/db/schema';

import { auditService, getAuditContext } from '$lib/server/audit';

// LENS TECHNOLOGIES
// ============================================================================

export const listTechnologiesBySupplier = query(
	LensSupplierIdSchema,
	async (data): Promise<LensTechnology[]> => {
		requireAuth();

		return getTechnologiesBySupplier(data.supplierId);
	}
);

export const createLensTechnologyForm = form(
	CreateLensTechnologySchema,
	async (data): Promise<LensTechnology> => {
		requireAdmin();

		const tech = await createLensTechnology(data);
		await auditService.logCreate('lens_technology', tech, getAuditContext());
		return tech;
	}
);

export const updateLensTechnologyForm = form(
	UpdateLensTechnologySchema,
	async (data): Promise<LensTechnology> => {
		requireAdmin();

		const { id, ...updates } = data;

		const existing = await findLensTechnologyById(id);
		if (!existing) invalid('Tecnología no encontrada');

		const updated = await updateLensTechnology(id, updates);
		if (!updated) invalid('Error actualizando tecnología');

		await auditService.logUpdate('lens_technology', id, existing, updated, getAuditContext());
		return updated;
	}
);

export const listTechnologies = query(
	ListTechnologiesSchema,
	async (data): Promise<LensTechnology[]> => {
		requireAuth();

		return getAllTechnologies({ search: data.search });
	}
);

export const deleteLensTechnologyById = command(LensIdSchema, async (data): Promise<void> => {
	requireAdmin();

	const existing = await findLensTechnologyById(data.id);
	if (!existing) throw new Error('Tecnología no encontrada');

	await db.transaction(async (tx) => {
		const ok = await softDelete('lens_technology', data.id, getAuditContext().userId ?? null, tx);
		if (!ok) throw new Error('Error eliminando tecnología');
	});

	await auditService.logDelete('lens_technology', existing, getAuditContext());
});

// ============================================================================
// LENS DIFFERENTIATORS
// ============================================================================

export const listDifferentiators = query(
	ListTechnologiesSchema,
	async (data): Promise<string[]> => {
		requireAuth();

		return getAllDifferentiators({ search: data.search });
	}
);

export const renameDifferentiatorForm = form(
	RenameDifferentiatorSchema,
	async (data): Promise<void> => {
		requireAdmin();

		await renameDifferentiator(data.oldName, data.newName);
		await auditService.logCustom(
			'lens_differentiator',
			`rename:${data.oldName}`,
			'update',
			{ nombre: { old: data.oldName, new: data.newName } },
			getAuditContext()
		);
	}
);

export const deleteDifferentiatorById = command(
	DeleteDifferentiatorSchema,
	async (data): Promise<void> => {
		requireAdmin();

		await deleteDifferentiator(data.name);
		await auditService.logCustom(
			'lens_differentiator',
			`delete:${data.name}`,
			'delete',
			{ nombre: { old: data.name, new: null } },
			getAuditContext()
		);
	}
);
