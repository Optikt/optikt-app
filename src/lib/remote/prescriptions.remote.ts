/**
 * Prescriptions Remote Functions
 * Server-side functions for prescription management
 */
import { query, form, command } from '$app/server';
import { requireAuth, requireRole, requireAdmin } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { invalid } from '@sveltejs/kit';
import {
	CreatePrescriptionSchema,
	UpdatePrescriptionSchema,
	PrescriptionIdSchema,
	CustomerIdForPrescriptionSchema,
	SetCurrentPrescriptionSchema,
	type PrescriptionFieldsInput
} from '$lib/schemas/prescriptions';
import {
	getCustomerPrescriptions,
	getLatestPrescription,
	findPrescriptionById,
	createPrescription,
	updatePrescription,
	deletePrescription,
	findCustomerById,
	unsetCurrentPrescriptions
} from '$lib/server/db/queries/customers';
import type { Prescription } from '$lib/server/db/schema';
import { auditService, getAuditContext } from '$lib/server/audit';
import {
	normalizeOpticalValue,
	buildTreatments,
	toPrescriptionInsert
} from '$lib/utils/prescription';
import { db } from '$lib/server/db';

/**
 * List all prescriptions for a customer
 */
export const listPrescriptions = query(
	CustomerIdForPrescriptionSchema,
	async (data): Promise<Prescription[]> => {
		requireAuth();

		return await getCustomerPrescriptions(data.customerId);
	}
);

/**
 * Get the latest/current prescription for a customer
 */
export const getLatestCustomerPrescription = query(
	CustomerIdForPrescriptionSchema,
	async (data): Promise<Prescription | null> => {
		requireAuth();

		return await getLatestPrescription(data.customerId);
	}
);

/**
 * Get a single prescription by ID
 */
export const getPrescription = query(
	PrescriptionIdSchema,
	async (data): Promise<Prescription | null> => {
		requireAuth();

		return await findPrescriptionById(data.id);
	}
);

/**
 * Shared prescription creation logic.
 * Runs inside a transaction: unsets current flag on siblings, then creates the new prescription.
 */
async function performCreatePrescription(
	data: PrescriptionFieldsInput & { customerId: string },
	context: ReturnType<typeof getAuditContext>
): Promise<Prescription> {
	const prescription = await db.transaction(async (tx) => {
		if (data.isCurrent) {
			await unsetCurrentPrescriptions(data.customerId, undefined, tx);
		}

		return await createPrescription(toPrescriptionInsert(data.customerId, data), tx);
	});

	// Audit log - best effort, after transaction succeeds
	await auditService.logCreate('prescription', prescription, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return prescription;
}

/**
 * Create a new prescription (form-based)
 */
export const createPrescriptionForm = form(
	CreatePrescriptionSchema,
	async (data, issue): Promise<Prescription> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

		const context = getAuditContext();

		// Verify customer exists
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			invalid(issue.customerId('Cliente no encontrado'));
		}

		return performCreatePrescription(data, context);
	}
);

/**
 * Create a new prescription (command-based, for programmatic use)
 */
export const createPrescriptionCommand = command(
	CreatePrescriptionSchema,
	async (data): Promise<{ success: boolean; entity?: Prescription; error?: string }> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

		const context = getAuditContext();

		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { success: false, error: 'Cliente no encontrado' };
		}

		const prescription = await performCreatePrescription(data, context);
		return { success: true, entity: prescription };
	}
);

/**
 * Update an existing prescription
 */
export const updatePrescriptionForm = form(
	UpdatePrescriptionSchema,
	async (data, issue): Promise<Prescription> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

		const context = getAuditContext();

		// Get existing prescription
		const existing = await findPrescriptionById(data.id);
		if (!existing) {
			invalid(issue.id('Fórmula no encontrada'));
		}

		// Build update object with normalized optical values (0 → null)
		const updateData: Partial<Omit<Prescription, 'id' | 'createdAt'>> = {};
		if (data.prescriptionDate !== undefined) {
			updateData.prescriptionDate = data.prescriptionDate;
		}
		if (data.odSphere !== undefined) updateData.odSphere = normalizeOpticalValue(data.odSphere);
		if (data.odCylinder !== undefined)
			updateData.odCylinder = normalizeOpticalValue(data.odCylinder);
		if (data.odAxis !== undefined) updateData.odAxis = normalizeOpticalValue(data.odAxis);
		if (data.odAddition !== undefined)
			updateData.odAddition = normalizeOpticalValue(data.odAddition);
		if (data.odAltura !== undefined) updateData.odAltura = data.odAltura ?? null;
		if (data.osSphere !== undefined) updateData.osSphere = normalizeOpticalValue(data.osSphere);
		if (data.osCylinder !== undefined)
			updateData.osCylinder = normalizeOpticalValue(data.osCylinder);
		if (data.osAxis !== undefined) updateData.osAxis = normalizeOpticalValue(data.osAxis);
		if (data.osAddition !== undefined)
			updateData.osAddition = normalizeOpticalValue(data.osAddition);
		if (data.osAltura !== undefined) updateData.osAltura = data.osAltura ?? null;
		if (data.dp !== undefined) updateData.dp = data.dp ?? null;
		if (data.npRight !== undefined) updateData.npRight = data.npRight ?? null;
		if (data.npLeft !== undefined) updateData.npLeft = data.npLeft ?? null;
		// Build treatments if any treatment field is present
		if (
			data.treatmentAntiReflective !== undefined ||
			data.treatmentBlueBlock !== undefined ||
			data.treatmentPhotochromic !== undefined ||
			data.treatmentOther !== undefined
		) {
			updateData.treatments = buildTreatments(data);
		}
		if (data.recommendedLensType !== undefined) {
			updateData.recommendedLensType = data.recommendedLensType ?? null;
		}
		if (data.notes !== undefined) updateData.notes = data.notes ?? null;
		if (data.doctorName !== undefined) updateData.doctorName = data.doctorName ?? null;
		if (data.isCurrent !== undefined) updateData.isCurrent = data.isCurrent;

		// Unset siblings + update in a single transaction
		const updated = await db.transaction(async (tx) => {
			if (data.isCurrent) {
				await unsetCurrentPrescriptions(existing.customerId, data.id, tx);
			}
			return await updatePrescription(data.id, updateData, tx);
		});

		if (!updated) {
			invalid(issue.id('Error al actualizar fórmula'));
		}

		// Audit log - best effort, after transaction succeeds
		await auditService.logUpdate('prescription', data.id, existing, updated, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});

		return updated;
	}
);

/**
 * Set a prescription as current/not current
 */
export const setCurrentPrescription = command(SetCurrentPrescriptionSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	// Get existing prescription
	const existing = await findPrescriptionById(data.id);
	if (!existing) {
		return { success: false, error: 'Fórmula no encontrada' };
	}

	// Unset siblings + update in a single transaction
	const updated = await db.transaction(async (tx) => {
		if (data.isCurrent) {
			await unsetCurrentPrescriptions(existing.customerId, data.id, tx);
		}
		return await updatePrescription(data.id, { isCurrent: data.isCurrent }, tx);
	});

	if (!updated) {
		return { success: false, error: 'Error al actualizar fórmula' };
	}

	// Audit log - best effort, after transaction succeeds
	await auditService.logUpdate('prescription', data.id, existing, updated, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true };
});

/**
 * Delete a prescription (soft delete)
 */
export const deletePrescriptionCommand = command(PrescriptionIdSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	// Get existing prescription
	const existing = await findPrescriptionById(data.id);
	if (!existing) {
		return { success: false, error: 'Fórmula no encontrada' };
	}

	// Delete prescription
	const deleted = await deletePrescription(data.id);
	if (!deleted) {
		return { success: false, error: 'Error al eliminar fórmula' };
	}

	// Log audit
	await auditService.logDelete('prescription', existing, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true };
});
