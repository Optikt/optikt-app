/**
 * Products Remote Functions
 * Server-side functions for product management
 */
import { query, form, command } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	ListProductsSchema,
	CreateProductSchema,
	UpdateProductSchema,
	ProductIdSchema
} from '$lib/schemas/products';
import {
	getAllProductsWithRelations,
	findProductById,
	findProductBySkuIncludingDeleted,
	findProductBySkuExcluding,
	createProduct,
	updateProduct,
	deleteProduct,
	reactivateProduct
} from '$lib/server/db/queries/products';
import { quickCreateBrand } from '$lib/remote/brands.remote';
import { quickCreateSupplier } from '$lib/remote/suppliers.remote';
import { quickCreateMaterial } from '$lib/remote/materials.remote';
import type { MaterialProductType } from '$lib/schemas/materials';
import type { Product } from '$lib/server/db/schema';
import type { ProductWithRelations } from '$lib/server/db/queries/products';

/**
 * Maps a ProductType to MaterialProductType
 * SUNGLASSES maps to FRAME since sunglasses are essentially frames
 */
function toMaterialProductType(type: string | undefined): MaterialProductType {
	if (!type || type === 'SUNGLASSES') return 'FRAME';
	if (type === 'FRAME' || type === 'LENS' || type === 'CONTACT_LENS' || type === 'ACCESSORY') {
		return type;
	}
	return 'FRAME';
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

		// Handle pending brand
		if (brandId && brandId.startsWith('pending_') && pendingBrandName) {
			const result = await quickCreateBrand({ name: pendingBrandName });
			brandId = result.id;
		}

		// Handle pending supplier
		if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
			const result = await quickCreateSupplier({ name: pendingSupplierName });
			supplierId = result.id;
		}

		// Handle pending material
		if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
			const result = await quickCreateMaterial({
				name: pendingMaterialName,
				productType: pendingMaterialProductType ?? toMaterialProductType(rest.type)
			});
			materialId = result.id;
		}

		// Check for duplicate SKU (including soft-deleted)
		const existingSku = await findProductBySkuIncludingDeleted(sku);
		if (existingSku) {
			// If it's soft-deleted, we can reactivate it with new data
			if (existingSku.deletedAt) {
				const reactivated = await updateProduct(existingSku.id, {
					...rest,
					brandId: brandId && brandId.trim() !== '' ? brandId : null,
					supplierId: supplierId && supplierId.trim() !== '' ? supplierId : null,
					materialId: materialId && materialId.trim() !== '' ? materialId : null,
					deletedAt: null,
					isActive: true
				});
				if (!reactivated) {
					invalid('Error reactivando producto');
				}
				return reactivated;
			}
			// Otherwise it's an active product with same SKU
			invalid(issue.sku('Ya existe un producto con este SKU'));
		}

		// Create new product
		return await createProduct({
			sku,
			brandId: brandId && brandId.trim() !== '' ? brandId : null,
			supplierId: supplierId && supplierId.trim() !== '' ? supplierId : null,
			materialId: materialId && materialId.trim() !== '' ? materialId : null,
			...rest
		});
	}
);

/**
 * Update an existing product with form validation
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

		// Handle pending brand
		if (brandId && brandId.startsWith('pending_') && pendingBrandName) {
			const result = await quickCreateBrand({ name: pendingBrandName });
			brandId = result.id;
		}

		// Handle pending supplier
		if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
			const result = await quickCreateSupplier({ name: pendingSupplierName });
			supplierId = result.id;
		}

		// Handle pending material
		if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
			const result = await quickCreateMaterial({
				name: pendingMaterialName,
				productType: pendingMaterialProductType ?? toMaterialProductType(rest.type)
			});
			materialId = result.id;
		}

		// Check if product exists
		const existing = await findProductById(id);
		if (!existing) {
			invalid('Producto no encontrado');
		}

		// Check for duplicate SKU if SKU is being changed
		if (sku && sku !== existing.sku) {
			const duplicate = await findProductBySkuExcluding(sku, id);
			if (duplicate) {
				invalid(issue.sku('Ya existe un producto con este SKU'));
			}
		}

		// Update product
		const updated = await updateProduct(id, {
			...(sku && { sku }),
			brandId:
				brandId !== undefined ? (brandId && brandId.trim() !== '' ? brandId : null) : undefined,
			supplierId:
				supplierId !== undefined
					? supplierId && supplierId.trim() !== ''
						? supplierId
						: null
					: undefined,
			materialId:
				materialId !== undefined
					? materialId && materialId.trim() !== ''
						? materialId
						: null
					: undefined,
			...rest
		});
		if (!updated) {
			invalid('Error actualizando producto');
		}

		return updated;
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

		return { isActive: updated.isActive };
	}
);

/**
 * Reactivate a soft-deleted product
 */
export const reactivateProductById = command(ProductIdSchema, async (data): Promise<Product> => {
	const { id } = data;

	const product = await reactivateProduct(id);
	if (!product) {
		throw new Error('Producto no encontrado');
	}

	return product;
});
