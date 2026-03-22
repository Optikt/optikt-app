/**
 * Products Remote Functions
 * Server-side functions for product management
 */
import { query, form, command } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { eq, isNull, and, ilike } from 'drizzle-orm';
import {
	ListProductsSchema,
	CreateProductSchema,
	UpdateProductSchema,
	ProductIdSchema,
	ReactivateProductSchema
} from '$lib/schemas/products';
import {
	getAllProductsWithRelations,
	countProducts,
	findProductById,
	findProductBySku,
	updateProduct,
	deleteProduct,
	restoreProduct
} from '$lib/server/db/queries/products';
import { ProductType, toMaterialCategory } from '$lib/shared/enums/productTypes';
import { db } from '$lib/server/db';
import { brands, materials, products, type Product } from '$lib/server/db/schema';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { resolvePendingSupplier } from '$lib/server/db/queries/suppliers';
import { auditService, getAuditContext } from '$lib/server/audit';

// Types for paginated response
export interface PaginatedProducts {
	products: ProductWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

// Types for create result
export interface CreateProductResult {
	success: boolean;
	message: string;
	product?: Product;
	reactivationCandidate?: Product;
}

/**
 * List products with pagination, search, and filters
 */
export const listProducts = query(ListProductsSchema, async (data): Promise<PaginatedProducts> => {
	const { page, perPage, ...filters } = data;
	const offset = (page - 1) * perPage;

	const [items, total] = await Promise.all([
		getAllProductsWithRelations({
			...filters,
			limit: perPage,
			offset,
			orderBy: 'createdAt',
			orderSort: 'desc'
		}),
		countProducts(filters)
	]);

	return {
		products: items,
		total,
		page,
		perPage,
		totalPages: Math.ceil(total / perPage)
	};
});

/**
 * Create a new product with form validation
 * All pending entity creation and product creation happen in a single transaction
 */
export const createProductForm = form(
	CreateProductSchema,
	async (data, issue): Promise<CreateProductResult> => {
		const {
			sku,
			pendingBrandName,
			pendingSupplierName,
			pendingMaterialName,
			pendingMaterialCategory,
			...rest
		} = data;
		let { brandId, supplierId, materialId } = data;

		// Check for DELETED product with same SKU (reactivation candidate)
		const deletedProduct = await findProductBySku(sku, { deleted: 'only' });
		if (deletedProduct) {
			// Can reactivate! Return candidate for confirmation
			return {
				success: false,
				reactivationCandidate: deletedProduct,
				message:
					'El SKU pertenece a un producto eliminado. ¿Desea reactivarlo con los nuevos datos?'
			};
		}

		// TODO: Validate deleted brands/suppliers/materials too?

		// Use a transaction for atomicity - all or nothing
		// IMPORTANT: All db operations inside must use `tx`, not `db`
		const product = await db.transaction(async (tx) => {
			const now = new Date();

			// TODO: Check whenever we found the "pending" things were deleted previously, this could fail.
			// So we should check for that and maybe reactivate them instead of creating new ones.

			// Handle pending brand
			if (brandId && brandId.startsWith('pending_') && pendingBrandName) {
				// Check if brand already exists (case-insensitive)
				const [existing] = await tx
					.select()
					.from(brands)
					.where(and(ilike(brands.name, pendingBrandName), isNull(brands.deletedAt)));

				if (existing) {
					brandId = existing.id;
				} else {
					const [newBrand] = await tx
						.insert(brands)
						.values({
							id: crypto.randomUUID(),
							name: pendingBrandName,
							createdAt: now,
							updatedAt: now
						})
						.returning();
					brandId = newBrand.id;
				}
			}

			// Handle pending supplier
			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const productType = pendingMaterialCategory ?? toMaterialCategory(rest.type);
				const [existing] = await tx
					.select()
					.from(materials)
					.where(
						and(
							ilike(materials.name, pendingMaterialName),
							eq(materials.productType, productType),
							isNull(materials.deletedAt)
						)
					);

				if (existing) {
					materialId = existing.id;
				} else {
					const code = pendingMaterialName.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
					const [newMaterial] = await tx
						.insert(materials)
						.values({
							id: crypto.randomUUID(),
							name: pendingMaterialName,
							code,
							productType,
							createdAt: now,
							updatedAt: now
						})
						.returning();
					materialId = newMaterial.id;
				}
			}

			// Check for duplicate SKU (including soft-deleted)
			const [existingSku] = await tx.select().from(products).where(eq(products.sku, sku));

			if (existingSku) {
				// If it's soft-deleted, just restore it (race condition guard — normally caught earlier)
				if (existingSku.deletedAt) {
					const [reactivated] = await tx
						.update(products)
						.set({
							deletedAt: null,
							isActive: true,
							updatedAt: now
						})
						.where(eq(products.id, existingSku.id))
						.returning();
					return reactivated;
				}
				// Otherwise it's an active product with same SKU
				invalid(issue.sku('Ya existe un producto con este SKU'));
			}

			// Create new product
			const [newProduct] = await tx
				.insert(products)
				.values({
					id: crypto.randomUUID(),
					...rest,
					sku,
					brandId: brandId && brandId.trim() !== '' ? brandId : null,
					supplierId, // Required, already resolved from pending or passed as UUID
					materialId, // Required, already resolved from pending or passed as UUID
					createdAt: now,
					updatedAt: now
				})
				.returning();

			return newProduct;
		});

		// Log the creation after transaction succeeds
		await auditService.logCreate('product', product, getAuditContext());

		return { success: true, product, message: 'Producto creado exitosamente' };
	}
);

/**
 * Update an existing product with form validation
 * All pending entity creation and product update happen in a single transaction
 */
export const updateProductForm = form(
	UpdateProductSchema,
	async (data, issue): Promise<Product> => {
		const {
			id,
			sku,
			pendingBrandName,
			pendingSupplierName,
			pendingMaterialName,
			pendingMaterialCategory,
			...rest
		} = data;
		let { brandId, supplierId, materialId } = data;

		// Use a transaction for atomicity - all or nothing
		// IMPORTANT: All db operations inside must use `tx`, not `db`
		const { oldProduct, updatedProduct } = await db.transaction(async (tx) => {
			const now = new Date();

			// Handle pending brand
			if (brandId && brandId.startsWith('pending_') && pendingBrandName) {
				const [existing] = await tx
					.select()
					.from(brands)
					.where(and(ilike(brands.name, pendingBrandName), isNull(brands.deletedAt)));

				if (existing) {
					brandId = existing.id;
				} else {
					const [newBrand] = await tx
						.insert(brands)
						.values({
							id: crypto.randomUUID(),
							name: pendingBrandName,
							createdAt: now,
							updatedAt: now
						})
						.returning();
					brandId = newBrand.id;
				}
			}

			// Handle pending supplier
			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const productType =
					pendingMaterialCategory ?? toMaterialCategory(rest.type ?? ProductType.FRAME);

				const [existing] = await tx
					.select()
					.from(materials)
					.where(
						and(
							ilike(materials.name, pendingMaterialName),
							eq(materials.productType, productType),
							isNull(materials.deletedAt)
						)
					);

				if (existing) {
					materialId = existing.id;
				} else {
					const code = pendingMaterialName.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
					const [newMaterial] = await tx
						.insert(materials)
						.values({
							id: crypto.randomUUID(),
							name: pendingMaterialName,
							code,
							productType,
							createdAt: now,
							updatedAt: now
						})
						.returning();
					materialId = newMaterial.id;
				}
			}

			// Check if product exists - also captures the old state for audit
			const [oldProduct] = await tx
				.select()
				.from(products)
				.where(and(eq(products.id, id), isNull(products.deletedAt)));
			if (!oldProduct) {
				throw new Error('Producto no encontrado');
			}

			// Check for duplicate SKU if SKU is being changed
			if (sku && sku !== oldProduct.sku) {
				const [duplicate] = await tx
					.select()
					.from(products)
					.where(and(eq(products.sku, sku), isNull(products.deletedAt)));
				if (duplicate && duplicate.id !== id) {
					invalid(issue.sku('Ya existe un producto con este SKU'));
				}
			}

			// Update product
			const [updated] = await tx
				.update(products)
				.set({
					...rest,
					...(sku && { sku }),
					brandId:
						brandId !== undefined ? (brandId && brandId.trim() !== '' ? brandId : null) : undefined,
					// supplierId and materialId are required - only update if provided, never set to null
					...(supplierId !== undefined && { supplierId }),
					...(materialId !== undefined && { materialId }),
					updatedAt: now
				})
				.where(eq(products.id, id))
				.returning();

			if (!updated) {
				throw new Error('Error actualizando producto');
			}

			return { oldProduct, updatedProduct: updated };
		});

		// Log the update after transaction succeeds
		await auditService.logUpdate('product', id, oldProduct, updatedProduct, getAuditContext());

		return updatedProduct;
	}
);

/**
 * Delete a product (soft delete)
 */
export const deleteProductById = command(ProductIdSchema, async (data): Promise<void> => {
	const { id } = data;

	const existing = await findProductById(id);
	if (!existing) {
		throw new Error('Producto no encontrado');
	}

	await deleteProduct(id);

	// Log the deletion
	await auditService.logDelete('product', existing, getAuditContext());
});

/**
 * Toggle product active status
 */
export const toggleProductActive = command(
	ProductIdSchema,
	async (data): Promise<{ isActive: boolean }> => {
		const { id } = data;

		const existing = await findProductById(id);
		if (!existing) {
			throw new Error('Producto no encontrado');
		}

		const updated = await updateProduct(id, { isActive: !existing.isActive });
		if (!updated) {
			throw new Error('Error actualizando producto');
		}

		// Log the status change
		await auditService.logUpdate('product', id, existing, updated, getAuditContext());

		return { isActive: updated.isActive };
	}
);

/**
 * Reactivate a soft-deleted product
 */
export const reactivateProduct = command(
	ReactivateProductSchema,
	async (data): Promise<Product> => {
		const { deletedProductId } = data;

		// Verify the product exists and is deleted
		const existing = await findProductById(deletedProductId, { deleted: true });
		if (!existing || !existing.deletedAt) {
			throw new Error('Producto eliminado no encontrado');
		}

		const restored = await restoreProduct(deletedProductId);
		if (!restored) {
			throw new Error('Error restaurando producto');
		}

		// Log the reactivation
		await auditService.logRestore('product', restored, getAuditContext());

		return restored;
	}
);
