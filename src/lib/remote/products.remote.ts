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
	findProductBySku,
	findProductBySkuExcluding,
	createProduct,
	updateProduct,
	deleteProduct,
	reactivateProduct
} from '$lib/server/db/queries/products';
import type { Product } from '$lib/server/db/schema';
import type { ProductWithRelations } from '$lib/server/db/queries/products';

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
		const { sku, brandId, supplierId, ...rest } = data;

		// Check for duplicate SKU
		const existingSku = await findProductBySku(sku);
		if (existingSku) {
			invalid(issue.sku('Ya existe un producto con este SKU'));
		}

		// Create product
		const product = await createProduct({
			sku,
			brandId: brandId && brandId.trim() !== '' ? brandId : null,
			supplierId: supplierId && supplierId.trim() !== '' ? supplierId : null,
			...rest
		});
		return product;
	}
);

/**
 * Update an existing product with form validation
 */
export const updateProductForm = form(
	UpdateProductSchema,
	async (data, issue): Promise<Product> => {
		const { id, sku, brandId, supplierId, ...rest } = data;

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
