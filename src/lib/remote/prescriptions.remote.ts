/**
 * Prescriptions Remote Functions
 * Server-side functions for prescription management
 */
import { query, form, command, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	CreatePrescriptionSchema,
	UpdatePrescriptionSchema,
	PrescriptionIdSchema,
	CustomerIdForPrescriptionSchema,
	SetCurrentPrescriptionSchema
} from '$lib/schemas/prescriptions';
import {
	getCustomerPrescriptions,
	getLatestPrescription,
	findPrescriptionById,
	createPrescription,
	updatePrescription,
	deletePrescription,
	findCustomerById
} from '$lib/server/db/queries/customers';
import type { Prescription, PrescriptionTreatments } from '$lib/server/db/schema';
import { auditService, type AuditContext } from '$lib/server/audit';

/**
 * Helper to build audit context from the request event
 */
function getAuditContext(): AuditContext {
	const event = getRequestEvent();
	return {
		userId: event.locals.user?.id ?? null,
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

/**
 * Build treatments object from form data
 */
function buildTreatments(data: {
	treatmentAntiReflective?: boolean;
	treatmentBlueBlock?: boolean;
	treatmentPhotochromic?: boolean;
	treatmentOther?: string;
}): PrescriptionTreatments | null {
	const hasAnyTreatment =
		data.treatmentAntiReflective ||
		data.treatmentBlueBlock ||
		data.treatmentPhotochromic ||
		data.treatmentOther;

	if (!hasAnyTreatment) return null;

	return {
		antiReflective: data.treatmentAntiReflective ?? false,
		blueBlock: data.treatmentBlueBlock ?? false,
		photochromic: data.treatmentPhotochromic ?? false,
		other: data.treatmentOther ?? null
	};
}

/**
 * List all prescriptions for a customer
 */
export const listPrescriptions = query(
	CustomerIdForPrescriptionSchema,
	async (data): Promise<Prescription[]> => {
		return await getCustomerPrescriptions(data.customerId);
	}
);

/**
 * Get the latest/current prescription for a customer
 */
export const getLatestCustomerPrescription = query(
	CustomerIdForPrescriptionSchema,
	async (data): Promise<Prescription | null> => {
		return await getLatestPrescription(data.customerId);
	}
);

/**
 * Get a single prescription by ID
 */
export const getPrescription = query(
	PrescriptionIdSchema,
	async (data): Promise<Prescription | null> => {
		return await findPrescriptionById(data.id);
	}
);

/**
 * Create a new prescription
 */
export const createPrescriptionForm = form(
	CreatePrescriptionSchema,
	async (data, issue): Promise<Prescription> => {
		const context = getAuditContext();

		// Verify customer exists
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			invalid(issue.customerId('Cliente no encontrado'));
		}

		// If this is set as current, unset other current prescriptions for this customer
		if (data.isCurrent) {
			const existingPrescriptions = await getCustomerPrescriptions(data.customerId);
			for (const p of existingPrescriptions) {
				if (p.isCurrent) {
					await updatePrescription(p.id, { isCurrent: false });
				}
			}
		}

		// Build treatments object
		const treatments = buildTreatments(data);

		// Create prescription
		const prescription = await createPrescription({
			customerId: data.customerId,
			prescriptionDate: new Date(data.prescriptionDate),
			odSphere: data.odSphere ?? null,
			odCylinder: data.odCylinder ?? null,
			odAxis: data.odAxis ?? null,
			odAddition: data.odAddition ?? null,
			osSphere: data.osSphere ?? null,
			osCylinder: data.osCylinder ?? null,
			osAxis: data.osAxis ?? null,
			osAddition: data.osAddition ?? null,
			dp: data.dp ?? null,
			npRight: data.npRight ?? null,
			npLeft: data.npLeft ?? null,
			treatments,
			recommendedLensType: data.recommendedLensType ?? null,
			notes: data.notes ?? null,
			doctorName: data.doctorName ?? null,
			isCurrent: data.isCurrent ?? false
		});

		// Log audit
		await auditService.logCreate('prescription', prescription, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});

		return prescription;
	}
);

/**
 * Update an existing prescription
 */
export const updatePrescriptionForm = form(
	UpdatePrescriptionSchema,
	async (data, issue): Promise<Prescription> => {
		const context = getAuditContext();

		// Get existing prescription
		const existing = await findPrescriptionById(data.id);
		if (!existing) {
			invalid(issue.id('Fórmula no encontrada'));
		}

		// If setting as current, unset other current prescriptions for this customer
		if (data.isCurrent) {
			const existingPrescriptions = await getCustomerPrescriptions(existing.customerId);
			for (const p of existingPrescriptions) {
				if (p.isCurrent && p.id !== data.id) {
					await updatePrescription(p.id, { isCurrent: false });
				}
			}
		}

		// Build update object
		const updateData: Partial<Omit<Prescription, 'id' | 'createdAt'>> = {};
		if (data.prescriptionDate !== undefined) {
			updateData.prescriptionDate = new Date(data.prescriptionDate);
		}
		if (data.odSphere !== undefined) updateData.odSphere = data.odSphere ?? null;
		if (data.odCylinder !== undefined) updateData.odCylinder = data.odCylinder ?? null;
		if (data.odAxis !== undefined) updateData.odAxis = data.odAxis ?? null;
		if (data.odAddition !== undefined) updateData.odAddition = data.odAddition ?? null;
		if (data.osSphere !== undefined) updateData.osSphere = data.osSphere ?? null;
		if (data.osCylinder !== undefined) updateData.osCylinder = data.osCylinder ?? null;
		if (data.osAxis !== undefined) updateData.osAxis = data.osAxis ?? null;
		if (data.osAddition !== undefined) updateData.osAddition = data.osAddition ?? null;
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

		// Update prescription
		const updated = await updatePrescription(data.id, updateData);
		if (!updated) {
			invalid(issue.id('Error al actualizar fórmula'));
		}

		// Log audit
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
	const context = getAuditContext();

	// Get existing prescription
	const existing = await findPrescriptionById(data.id);
	if (!existing) {
		return { success: false, error: 'Fórmula no encontrada' };
	}

	// If setting as current, unset other current prescriptions for this customer
	if (data.isCurrent) {
		const existingPrescriptions = await getCustomerPrescriptions(existing.customerId);
		for (const p of existingPrescriptions) {
			if (p.isCurrent && p.id !== data.id) {
				await updatePrescription(p.id, { isCurrent: false });
			}
		}
	}

	// Update prescription
	const updated = await updatePrescription(data.id, { isCurrent: data.isCurrent });
	if (!updated) {
		return { success: false, error: 'Error al actualizar fórmula' };
	}

	// Log audit
	await auditService.logUpdate('prescription', data.id, existing, updated, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true };
});

/**
 * Delete a prescription (soft delete)
 */
export const deletePrescriptionCommand = command(PrescriptionIdSchema, async (data) => {
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
