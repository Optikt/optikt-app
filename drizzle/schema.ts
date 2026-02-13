import { pgTable, varchar, index, uniqueIndex, uuid, timestamp, date, json, foreignKey, doublePrecision, boolean, integer, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const alembicVersion = pgTable("alembic_version", {
	versionNum: varchar("version_num", { length: 32 }).primaryKey().notNull(),
});

export const brands = pgTable("brands", {
	name: varchar().notNull(),
	description: varchar(),
	country: varchar(),
	logoUrl: varchar("logo_url"),
	website: varchar(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_brands_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ix_brands_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const customers = pgTable("customers", {
	firstName: varchar("first_name").notNull(),
	lastName: varchar("last_name").notNull(),
	idNumber: varchar("id_number"),
	birthDate: date("birth_date"),
	primaryPhone: varchar("primary_phone").notNull(),
	email: varchar(),
	address: varchar(),
	secondaryPhones: json("secondary_phones"),
	notes: varchar(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_customers_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ix_customers_id_number").using("btree", table.idNumber.asc().nullsLast().op("text_ops")),
	index("ix_customers_primary_phone").using("btree", table.primaryPhone.asc().nullsLast().op("text_ops")),
]);

export const lensCatalogItems = pgTable("lens_catalog_items", {
	supplierId: uuid("supplier_id").notNull(),
	name: varchar().notNull(),
	brand: varchar(),
	type: varchar().notNull(),
	materialId: uuid("material_id").notNull(),
	baseFeatures: json("base_features"),
	isPhotochromic: boolean("is_photochromic").notNull(),
	basePrice: doublePrecision("base_price").notNull(),
	salePrice: doublePrecision("sale_price"),
	mountingPrice: doublePrecision("mounting_price"),
	deliveryDays: integer("delivery_days"),
	stock: integer(),
	refractiveIndex: doublePrecision("refractive_index"),
	notes: varchar(),
	isActive: boolean("is_active").notNull(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_lens_catalog_items_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_lens_catalog_items_material_id").using("btree", table.materialId.asc().nullsLast().op("uuid_ops")),
	index("ix_lens_catalog_items_supplier_id").using("btree", table.supplierId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [lensMaterials.id],
			name: "lens_catalog_items_material_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "lens_catalog_items_supplier_id_fkey"
		}).onDelete("cascade"),
]);

export const lensMaterials = pgTable("lens_materials", {
	name: varchar().notNull(),
	code: varchar().notNull(),
	refractiveIndex: doublePrecision("refractive_index"),
	description: varchar(),
	isActive: boolean("is_active").notNull(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("ix_lens_materials_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("ix_lens_materials_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ix_lens_materials_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const lensTreatments = pgTable("lens_treatments", {
	name: varchar().notNull(),
	code: varchar().notNull(),
	description: varchar(),
	isActive: boolean("is_active").notNull(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("ix_lens_treatments_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("ix_lens_treatments_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ix_lens_treatments_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const prescriptions = pgTable("prescriptions", {
	customerId: uuid("customer_id").notNull(),
	prescriptionDate: date("prescription_date").notNull(),
	odSphere: doublePrecision("od_sphere"),
	odCylinder: doublePrecision("od_cylinder"),
	odAxis: integer("od_axis"),
	odAddition: doublePrecision("od_addition"),
	osSphere: doublePrecision("os_sphere"),
	osCylinder: doublePrecision("os_cylinder"),
	osAxis: integer("os_axis"),
	osAddition: doublePrecision("os_addition"),
	pd: doublePrecision(),
	pdRight: doublePrecision("pd_right"),
	pdLeft: doublePrecision("pd_left"),
	recommendedLensType: varchar("recommended_lens_type"),
	notes: varchar(),
	doctorName: varchar("doctor_name"),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_prescriptions_customer_id").using("btree", table.customerId.asc().nullsLast().op("uuid_ops")),
	index("ix_prescriptions_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_prescriptions_prescription_date").using("btree", table.prescriptionDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "prescriptions_customer_id_fkey"
		}).onDelete("cascade"),
]);

export const products = pgTable("products", {
	sku: varchar().notNull(),
	name: varchar().notNull(),
	type: varchar().notNull(),
	brandId: uuid("brand_id"),
	supplierId: uuid("supplier_id"),
	color: varchar(),
	size: varchar(),
	description: varchar(),
	purchasePrice: doublePrecision("purchase_price").notNull(),
	salePrice: doublePrecision("sale_price").notNull(),
	stock: integer(),
	minStock: integer("min_stock"),
	imageUrl: varchar("image_url"),
	isActive: boolean("is_active").notNull(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_products_brand_id").using("btree", table.brandId.asc().nullsLast().op("uuid_ops")),
	index("ix_products_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_products_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	uniqueIndex("ix_products_sku").using("btree", table.sku.asc().nullsLast().op("text_ops")),
	index("ix_products_supplier_id").using("btree", table.supplierId.asc().nullsLast().op("uuid_ops")),
	index("ix_products_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.brandId],
			foreignColumns: [brands.id],
			name: "products_brand_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "products_supplier_id_fkey"
		}).onDelete("set null"),
]);

export const saleItems = pgTable("sale_items", {
	saleId: uuid("sale_id").notNull(),
	productId: uuid("product_id"),
	lensCatalogItemId: uuid("lens_catalog_item_id"),
	selectedTreatments: json("selected_treatments"),
	quantity: integer().notNull(),
	unitPrice: doublePrecision("unit_price").notNull(),
	discount: doublePrecision().notNull(),
	notes: varchar(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_sale_items_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_sale_items_lens_catalog_item_id").using("btree", table.lensCatalogItemId.asc().nullsLast().op("uuid_ops")),
	index("ix_sale_items_product_id").using("btree", table.productId.asc().nullsLast().op("uuid_ops")),
	index("ix_sale_items_sale_id").using("btree", table.saleId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: "sale_items_lens_catalog_item_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sale_items_product_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: "sale_items_sale_id_fkey"
		}).onDelete("cascade"),
]);

export const sales = pgTable("sales", {
	customerId: uuid("customer_id").notNull(),
	sellerId: uuid("seller_id").notNull(),
	saleDate: timestamp("sale_date", { mode: 'string' }).notNull(),
	status: varchar().notNull(),
	subtotal: doublePrecision().notNull(),
	discount: doublePrecision().notNull(),
	total: doublePrecision().notNull(),
	paymentMethod: varchar("payment_method").notNull(),
	notes: varchar(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_sales_customer_id").using("btree", table.customerId.asc().nullsLast().op("uuid_ops")),
	index("ix_sales_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_sales_sale_date").using("btree", table.saleDate.asc().nullsLast().op("timestamp_ops")),
	index("ix_sales_seller_id").using("btree", table.sellerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_customer_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.sellerId],
			foreignColumns: [users.id],
			name: "sales_seller_id_fkey"
		}).onDelete("restrict"),
]);

export const supplierLensTreatments = pgTable("supplier_lens_treatments", {
	supplierId: uuid("supplier_id").notNull(),
	treatmentId: uuid("treatment_id").notNull(),
	price: doublePrecision().notNull(),
	isAvailable: boolean("is_available").notNull(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_supplier_lens_treatments_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_supplier_lens_treatments_supplier_id").using("btree", table.supplierId.asc().nullsLast().op("uuid_ops")),
	index("ix_supplier_lens_treatments_treatment_id").using("btree", table.treatmentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "supplier_lens_treatments_supplier_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.treatmentId],
			foreignColumns: [lensTreatments.id],
			name: "supplier_lens_treatments_treatment_id_fkey"
		}).onDelete("cascade"),
	unique("uq_supplier_treatment").on(table.supplierId, table.treatmentId),
]);

export const lensOpticalRanges = pgTable("lens_optical_ranges", {
	lensCatalogItemId: uuid("lens_catalog_item_id").notNull(),
	sphereMin: doublePrecision("sphere_min").notNull(),
	sphereMax: doublePrecision("sphere_max").notNull(),
	cylinderMin: doublePrecision("cylinder_min"),
	cylinderMax: doublePrecision("cylinder_max"),
	additionMin: doublePrecision("addition_min"),
	additionMax: doublePrecision("addition_max"),
	id: uuid().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_lens_optical_ranges_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_lens_optical_ranges_item_id").using("btree", table.lensCatalogItemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: "lens_optical_ranges_item_id_fkey"
		}).onDelete("cascade"),
]);

export const suppliers = pgTable("suppliers", {
	name: varchar().notNull(),
	type: varchar().notNull(),
	rif: varchar(),
	primaryPhone: varchar("primary_phone").notNull(),
	email: varchar(),
	address: varchar(),
	secondaryPhones: json("secondary_phones"),
	instagram: varchar(),
	whatsapp: varchar(),
	website: varchar(),
	contactPersons: json("contact_persons"),
	notes: varchar(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_suppliers_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_suppliers_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	uniqueIndex("ix_suppliers_rif").using("btree", table.rif.asc().nullsLast().op("text_ops")),
]);

export const userSessions = pgTable("user_sessions", {
	userId: uuid("user_id").notNull(),
	tokenHash: varchar("token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	isActive: boolean("is_active").notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: varchar("user_agent", { length: 255 }),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("ix_user_sessions_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("ix_user_sessions_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ix_user_sessions_token_hash").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	index("ix_user_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sessions_user_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	email: varchar().notNull(),
	username: varchar().notNull(),
	fullName: varchar("full_name").notNull(),
	hashedPassword: varchar("hashed_password").notNull(),
	isActive: boolean("is_active").notNull(),
	isSuperuser: boolean("is_superuser").notNull(),
	role: varchar().notNull(),
	id: uuid().primaryKey().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("ix_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_users_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_users_username").using("btree", table.username.asc().nullsLast().op("text_ops")),
	uniqueIndex("ix_users_username_lower").using("btree", sql`lower((username)::text)`),
]);
