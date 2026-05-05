/**
 * Products Remote Functions
 * Server-side functions for product management
 */
import { query, form, command } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';
import { invalid } from '@sveltejs/kit';
import { eq, isNull, and } from 'drizzle-orm';
import { z } from 'zod';
import {
	ListProductsSchema,
	CreateProductSchema,
	UpdateProductSchema,
	ProductIdSchema,
	ReactivateProductSchema,
	UpdateSalePriceSchema
} from '$lib/schemas/products';
import {
	getAllProductsWithRelations,
	countProducts,
	getProductInventoryStats as getProductInventoryStatsQuery,
	findProductById,
	findProductBySku,
	updateProduct,
	deleteProduct,
	restoreProduct
} from '$lib/server/db/queries/products';
import { upsertBrandSupplierLink } from '$lib/server/db/queries/brandSuppliers';
import { ProductType, toMaterialCategory } from '$lib/shared/enums/productTypes';
import { db } from '$lib/server/db';
import { products, type Product } from '$lib/server/db/schema';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { resolvePendingSupplier } from '$lib/server/db/queries/suppliers';
import { resolvePendingMaterial } from '$lib/server/db/queries/materials';
import { resolvePendingBrand } from '$lib/server/db/queries/brands';
import { auditService, getAuditContext } from '$lib/server/audit';
import type { CreateEntityResult, PaginatedResult } from '$lib/types';
import { nowISO } from '$lib/dates';

// Types for paginated response
export interface PaginatedProducts {
	products: ProductWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

export interface ProductInventoryStats {
	total: number;
	lowStock: number;
	outOfStock: number;
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
export const listProducts = query(
	ListProductsSchema,
	async (data): Promise<PaginatedResult<ProductWithRelations>> => {
		requireAuth();

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
			items: items,
			total,
			page,
			perPage,
			totalPages: Math.ceil(total / perPage)
		};
	}
);

export const getProductInventoryStats = query(
	z.object({}),
	async (): Promise<ProductInventoryStats> => {
		requireAuth();

		return getProductInventoryStatsQuery();
	}
);

/**
 * Create a new product with form validation
 * All pending entity creation and product creation happen in a single transaction
 */
export const createProductForm = form(
	CreateProductSchema,
	async (data, issue): Promise<CreateEntityResult<Product>> => {
		requireAdmin();

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
			const now = nowISO();

			// TODO: Check whenever we found the "pending" things were deleted previously, this could fail.
			// So we should check for that and maybe reactivate them instead of creating new ones.

			// Handle pending brand
			if (brandId && brandId.startsWith('pending_') && pendingBrandName) {
				brandId = await resolvePendingBrand(pendingBrandName, now, tx);
			}

			// Handle pending supplier
			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const productType = pendingMaterialCategory ?? toMaterialCategory(rest.type);
				materialId = await resolvePendingMaterial(pendingMaterialName, productType, now, tx);
			}

			if (brandId && supplierId) {
				await upsertBrandSupplierLink(brandId, supplierId, tx);
			}

			// Check for duplicate SKU (including soft-deleted)
			const [existingSku] = await tx.select().from(products).where(eq(products.sku, sku));

			if (existingSku) {
				// If it's soft-deleted, just restore it (race condition guard - normally caught earlier)
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

		return { success: true, entity: product, message: 'Producto creado exitosamente' };
	}
);

/**
 * Update an existing product with form validation
 * All pending entity creation and product update happen in a single transaction
 */
export const updateProductForm = form(
	UpdateProductSchema,
	async (data, issue): Promise<Product> => {
		requireAdmin();

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
			const now = nowISO();

			// Handle pending brand
			if (brandId && brandId.startsWith('pending_') && pendingBrandName) {
				brandId = await resolvePendingBrand(pendingBrandName, now, tx);
			}

			// Handle pending supplier
			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const productType =
					pendingMaterialCategory ?? toMaterialCategory(rest.type ?? ProductType.FRAME);
				materialId = await resolvePendingMaterial(pendingMaterialName, productType, now, tx);
			}

			const resolvedBrandId =
				brandId !== undefined ? (brandId && brandId.trim() !== '' ? brandId : null) : undefined;

			if (resolvedBrandId && supplierId) {
				await upsertBrandSupplierLink(resolvedBrandId, supplierId, tx);
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
					brandId: resolvedBrandId,
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
	requireAdmin();

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
		requireAdmin();

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
		requireAdmin();

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

export const updateSalePriceCmd = command(UpdateSalePriceSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const product = await findProductById(data.id);
	if (!product) {
		return { success: false as const, error: 'Producto no encontrado' };
	}

	const old = { currentSalePrice: product.currentSalePrice };
	const updated = await updateProduct(data.id, { currentSalePrice: data.currentSalePrice });

	await auditService.logUpdate(
		'product' as never,
		data.id,
		old,
		{ currentSalePrice: data.currentSalePrice },
		context
	);

	return {
		success: true as const,
		currentSalePrice: updated?.currentSalePrice ?? data.currentSalePrice
	};
});
