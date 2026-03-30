import { relations } from "drizzle-orm/relations";
import { lensMaterials, lensCatalogItems, lensOpticalRanges, suppliers, supplierTreatments, customers, prescriptions, brands, products, saleItems, sales, users, userSessions } from "./schema";

export const lensCatalogItemsRelations = relations(lensCatalogItems, ({one, many}) => ({
	lensMaterial: one(lensMaterials, {
		fields: [lensCatalogItems.materialId],
		references: [lensMaterials.id]
	}),
	supplier: one(suppliers, {
		fields: [lensCatalogItems.supplierId],
		references: [suppliers.id]
	}),
	saleItems: many(saleItems),
	opticalRanges: many(lensOpticalRanges),
}));

export const lensOpticalRangesRelations = relations(lensOpticalRanges, ({one}) => ({
	lensCatalogItem: one(lensCatalogItems, {
		fields: [lensOpticalRanges.lensCatalogItemId],
		references: [lensCatalogItems.id]
	}),
}));

export const lensMaterialsRelations = relations(lensMaterials, ({many}) => ({
	lensCatalogItems: many(lensCatalogItems),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	lensCatalogItems: many(lensCatalogItems),
	products: many(products),
	supplierTreatments: many(supplierTreatments),
}));

export const supplierTreatmentsRelations = relations(supplierTreatments, ({one, many}) => ({
	supplier: one(suppliers, {
		fields: [supplierTreatments.supplierId],
		references: [suppliers.id]
	}),
	saleItems: many(saleItems),
}));

export const prescriptionsRelations = relations(prescriptions, ({one}) => ({
	customer: one(customers, {
		fields: [prescriptions.customerId],
		references: [customers.id]
	}),
}));

export const customersRelations = relations(customers, ({many}) => ({
	prescriptions: many(prescriptions),
	sales: many(sales),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	brand: one(brands, {
		fields: [products.brandId],
		references: [brands.id]
	}),
	supplier: one(suppliers, {
		fields: [products.supplierId],
		references: [suppliers.id]
	}),
	saleItems: many(saleItems),
}));

export const brandsRelations = relations(brands, ({many}) => ({
	products: many(products),
}));

export const saleItemsRelations = relations(saleItems, ({one, many}) => ({
	lensCatalogItem: one(lensCatalogItems, {
		fields: [saleItems.lensCatalogItemId],
		references: [lensCatalogItems.id]
	}),
	product: one(products, {
		fields: [saleItems.productId],
		references: [products.id]
	}),
	sale: one(sales, {
		fields: [saleItems.saleId],
		references: [sales.id]
	}),
	parentSaleItem: one(saleItems, {
		fields: [saleItems.parentSaleItemId],
		references: [saleItems.id],
		relationName: 'saleItemParent'
	}),
	childSaleItems: many(saleItems, {
		relationName: 'saleItemParent'
	}),
	supplierTreatment: one(supplierTreatments, {
		fields: [saleItems.supplierTreatmentId],
		references: [supplierTreatments.id]
	}),
}));

export const salesRelations = relations(sales, ({one, many}) => ({
	saleItems: many(saleItems),
	customer: one(customers, {
		fields: [sales.customerId],
		references: [customers.id]
	}),
	user: one(users, {
		fields: [sales.sellerId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	sales: many(sales),
	userSessions: many(userSessions),
}));

export const userSessionsRelations = relations(userSessions, ({one}) => ({
	user: one(users, {
		fields: [userSessions.userId],
		references: [users.id]
	}),
}));