import { and, eq, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	deletedItems,
	products,
	brands,
	customers,
	prescriptions,
	suppliers,
	materials,
	lensMaterials,
	lensTechnologies,
	lensCatalogItems,
	supplierTreatments,
	users,
	type DeletedEntityType,
	type DeletedItem
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';
import { deleteProduct } from './products';
import { deleteBrand } from './brands';
import { deleteCustomer, deletePrescription } from './customers';
import { deleteSupplier, deleteSupplierTreatment } from './suppliers';
import { deleteMaterial } from './materials';
import { deleteLensMaterial, deleteLensTechnology, deleteLensCatalogItem } from './lenses';
import { deleteUser } from './users';

type Row = Record<string, unknown>;

interface EntityAdapter {
	softDelete: (id: string, executor: DbOrTx) => Promise<boolean>;
	snapshot: (id: string, executor: DbOrTx) => Promise<Row | null>;
	/** Human-readable label for the trash list */
	label: (row: Row) => string;
}

// ---------------------------------------------------------------------------
// Entity registry: maps an entityType to its soft-delete + snapshot logic.
// Restore is generic: clear deleted_at. All writes take the executor.
// ---------------------------------------------------------------------------
const REGISTRY: Partial<Record<DeletedEntityType, EntityAdapter>> = {
	user: {
		softDelete: deleteUser,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(users).where(eq(users.id, id));
			if (!row) return null;
			const { hashedPassword: _hp, ...safe } = row;
			return safe;
		},
		label: (r) => String(r.fullName ?? r.username ?? 'Usuario')
	},
	product: {
		softDelete: deleteProduct,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(products).where(eq(products.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? r.sku ?? 'Producto')
	},
	brand: {
		softDelete: deleteBrand,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(brands).where(eq(brands.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? 'Marca')
	},
	customer: {
		softDelete: deleteCustomer,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(customers).where(eq(customers.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.fullName ?? r.name ?? 'Cliente')
	},
	prescription: {
		softDelete: deletePrescription,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(prescriptions).where(eq(prescriptions.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.customerId ?? 'Prescripción')
	},
	supplier: {
		softDelete: deleteSupplier,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(suppliers).where(eq(suppliers.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? 'Proveedor')
	},
	material: {
		softDelete: deleteMaterial,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(materials).where(eq(materials.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? r.code ?? 'Material')
	},
	lens_material: {
		softDelete: deleteLensMaterial,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(lensMaterials).where(eq(lensMaterials.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? r.code ?? 'Material de lente')
	},
	lens_technology: {
		softDelete: deleteLensTechnology,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(lensTechnologies).where(eq(lensTechnologies.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? 'Tecnología')
	},
	lens_catalog_item: {
		softDelete: deleteLensCatalogItem,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(lensCatalogItems).where(eq(lensCatalogItems.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? 'Lente')
	},
	supplier_treatment: {
		softDelete: deleteSupplierTreatment,
		snapshot: async (id, ex) => {
			const [row] = await ex.select().from(supplierTreatments).where(eq(supplierTreatments.id, id));
			return (row as Row | undefined) ?? null;
		},
		label: (r) => String(r.name ?? 'Tratamiento')
	}
};

const RESTORE: Partial<
	Record<DeletedEntityType, (id: string, executor: DbOrTx) => Promise<boolean>>
> = {
	user: async (id, ex) => {
		await ex.update(users).set({ deletedAt: null, updatedAt: nowISO() }).where(eq(users.id, id));
		return true;
	},
	product: async (id, ex) => {
		await ex
			.update(products)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(products.id, id));
		return true;
	},
	brand: async (id, ex) => {
		await ex.update(brands).set({ deletedAt: null, updatedAt: nowISO() }).where(eq(brands.id, id));
		return true;
	},
	customer: async (id, ex) => {
		await ex
			.update(customers)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(customers.id, id));
		return true;
	},
	prescription: async (id, ex) => {
		await ex
			.update(prescriptions)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(prescriptions.id, id));
		return true;
	},
	supplier: async (id, ex) => {
		await ex
			.update(suppliers)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(suppliers.id, id));
		return true;
	},
	material: async (id, ex) => {
		await ex
			.update(materials)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(materials.id, id));
		return true;
	},
	lens_material: async (id, ex) => {
		await ex
			.update(lensMaterials)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(lensMaterials.id, id));
		return true;
	},
	lens_technology: async (id, ex) => {
		await ex
			.update(lensTechnologies)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(lensTechnologies.id, id));
		return true;
	},
	lens_catalog_item: async (id, ex) => {
		await ex
			.update(lensCatalogItems)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(lensCatalogItems.id, id));
		return true;
	},
	supplier_treatment: async (id, ex) => {
		await ex
			.update(supplierTreatments)
			.set({ deletedAt: null, updatedAt: nowISO() })
			.where(eq(supplierTreatments.id, id));
		return true;
	}
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Soft-delete an entity and record it in the trash registry.
 * Must run inside a transaction (pass tx as executor) so the entity delete and
 * the deleted_items row commit atomically.
 *
 * @returns false if the entity was already deleted or does not exist.
 */
export async function softDelete(
	entityType: DeletedEntityType,
	id: string,
	deletedBy: string | null,
	executor: DbOrTx
): Promise<boolean> {
	const adapter = REGISTRY[entityType];
	if (!adapter) return false;

	const snapshot = await adapter.snapshot(id, executor);
	const removed = await adapter.softDelete(id, executor);
	if (!removed) return false;

	await executor.insert(deletedItems).values({
		id: crypto.randomUUID(),
		entityType,
		entityId: id,
		deletedBy,
		deletedAt: nowISO(),
		snapshot,
		createdAt: nowISO()
	});

	return true;
}

/**
 * Restore a soft-deleted entity (clear deleted_at and remove trash entry).
 */
export async function restore(
	entityType: DeletedEntityType,
	id: string,
	executor: DbOrTx
): Promise<boolean> {
	const restoreFn = RESTORE[entityType];
	if (!restoreFn) return false;
	await restoreFn(id, executor);
	await executor
		.delete(deletedItems)
		.where(and(eq(deletedItems.entityType, entityType), eq(deletedItems.entityId, id)));
	return true;
}

/**
 * List all trashed items (newest first).
 */
export function listTrash(): Promise<DeletedItem[]> {
	return db.select().from(deletedItems).orderBy(desc(deletedItems.deletedAt));
}

/**
 * Resolve a display label for a trashed item from its snapshot.
 */
export function trashLabel(item: DeletedItem): string {
	const adapter = REGISTRY[item.entityType];
	if (!adapter) return item.entityType;
	return adapter.label((item.snapshot as Row | undefined) ?? {});
}
