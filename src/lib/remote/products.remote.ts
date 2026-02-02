/**
 * Products Remote Functions
 * Server-side functions for product management
 */
import { query, form, command, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { eq, isNull, and, ilike } from 'drizzle-orm';
import {
	ListProductsSchema,
	CreateProductSchema,
	UpdateProductSchema,
	ProductIdSchema
} from '$lib/schemas/products';
import {
	getAllProductsWithRelations,
	findProductById,
	updateProduct,
	deleteProduct,
	reactivateProduct
} from '$lib/server/db/queries/products';
import { ProductType, toMaterialProductType } from '$lib/shared/enums/productTypes';
import { db } from '$lib/server/db';
import { brands, suppliers, materials, products, type Product } from '$lib/server/db/schema';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
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

// Types for paginated response
export interface PaginatedProducts {
	products: ProductWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

/**
 * List products with pagination, search, and filters
 */
export const listProducts = query(ListProductsSchema, async (data): Promise<PaginatedProducts> => {
	const { page, perPage, search, type, brandId, supplierId, includeInactive, lowStockOnly } = data;

	// Get all products with relations
	let allProducts = await getAllProductsWithRelations();

	// Filter by active status
	if (!includeInactive) {
		allProducts = allProducts.filter((p) => p.isActive);
	}

	// Apply search filter (name or SKU)
	if (search) {
		const searchLower = search.toLowerCase();
		allProducts = allProducts.filter(
			(product) =>
				product.name.toLowerCase().includes(searchLower) ||
				product.sku.toLowerCase().includes(searchLower)
		);
	}

	// Apply type filter
	if (type) {
		allProducts = allProducts.filter((p) => p.type === type);
	}

	// Apply brand filter
	if (brandId) {
		allProducts = allProducts.filter((p) => p.brandId === brandId);
	}

	// Apply supplier filter
	if (supplierId) {
		allProducts = allProducts.filter((p) => p.supplierId === supplierId);
	}

	// Apply low stock filter
	if (lowStockOnly) {
		allProducts = allProducts.filter(
			(p) => p.stock !== null && p.minStock !== null && p.stock <= p.minStock
		);
	}

	// Calculate pagination
	const total = allProducts.length;
	const totalPages = Math.ceil(total / perPage);
	const offset = (page - 1) * perPage;
	const products = allProducts.slice(offset, offset + perPage);

	return { products, total, page, perPage, totalPages };
});

/**
 * Create a new product with form validation
 * All pending entity creation and product creation happen in a single transaction
 */
export const createProductForm = form(
	CreateProductSchema,
	async (data, issue): Promise<Product> => {
		const {
			sku,
			pendingBrandName,
			pendingSupplierName,
			pendingMaterialName,
			pendingMaterialProductType,
			...rest
		} = data;
		let { brandId, supplierId, materialId } = data;

		// TODO: Validate existing products SKUs maybe? For not duplicates? Even soft-deleted?
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
				const [existing] = await tx
					.select()
					.from(suppliers)
					.where(and(ilike(suppliers.name, pendingSupplierName), isNull(suppliers.deletedAt)));

				if (existing) {
					supplierId = existing.id;
				} else {
					const [newSupplier] = await tx
						.insert(suppliers)
						.values({
							id: crypto.randomUUID(),
							name: pendingSupplierName,
							type: 'DISTRIBUTOR',
							primaryPhone: '',
							createdAt: now,
							updatedAt: now
						})
						.returning();
					supplierId = newSupplier.id;
				}
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const productType = pendingMaterialProductType ?? toMaterialProductType(rest.type);
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
				// If it's soft-deleted, we can reactivate it with new data
				if (existingSku.deletedAt) {
					const [reactivated] = await tx
						.update(products)
						.set({
							...rest,
							brandId: brandId && brandId.trim() !== '' ? brandId : null,
							supplierId, // Required, already resolved from pending or passed as UUID
							materialId, // Required, already resolved from pending or passed as UUID
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

		return product;
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
			pendingMaterialProductType,
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
				const [existing] = await tx
					.select()
					.from(suppliers)
					.where(and(ilike(suppliers.name, pendingSupplierName), isNull(suppliers.deletedAt)));

				if (existing) {
					supplierId = existing.id;
				} else {
					const [newSupplier] = await tx
						.insert(suppliers)
						.values({
							id: crypto.randomUUID(),
							name: pendingSupplierName,
							type: 'DISTRIBUTOR',
							primaryPhone: '',
							createdAt: now,
							updatedAt: now
						})
						.returning();
					supplierId = newSupplier.id;
				}
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const productType =
					pendingMaterialProductType ?? toMaterialProductType(rest.type ?? ProductType.FRAME);

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
export const reactivateProductById = command(ProductIdSchema, async (data): Promise<Product> => {
	const { id } = data;

	// Get the product before reactivation (it's soft-deleted so we need to find it differently)
	const [existing] = await db.select().from(products).where(eq(products.id, id));

	const product = await reactivateProduct(id);
	if (!product) {
		throw new Error('Producto no encontrado');
	}

	// Log the restoration
	if (existing) {
		await auditService.logRestore('product', product, getAuditContext());
	}

	return product;
});
