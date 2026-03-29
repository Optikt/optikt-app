/**
 * Seed demo data: suppliers, brands, materials, lens materials,
 * lens catalog items, supplier treatments, products, and a customer.
 *
 * Usage: DATABASE_URL="..." pnpm tsx scripts/seed-demo.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
	const DATABASE_URL = process.env.DATABASE_URL;
	if (!DATABASE_URL) {
		console.error('❌ DATABASE_URL is not set');
		process.exit(1);
	}

	console.log('🔌 Connecting to database...');
	const client = postgres(DATABASE_URL);
	const db = drizzle(client, { schema });

	// ── Guard: skip if demo data already exists ─────────────────────────
	const [existingSupplier] = await db
		.select()
		.from(schema.suppliers)
		.where(eq(schema.suppliers.name, 'Óptica Lab VE'))
		.limit(1);

	if (existingSupplier) {
		console.log('⚠️  Demo data already exists, skipping.');
		await client.end();
		return;
	}

	const now = new Date();

	// ── 1. Brands ───────────────────────────────────────────────────────
	console.log('🏷  Creating brands...');
	const [brandRayBan] = await db
		.insert(schema.brands)
		.values({ name: 'Ray-Ban', country: 'Italia', createdAt: now, updatedAt: now })
		.returning();
	const [brandOakley] = await db
		.insert(schema.brands)
		.values({ name: 'Oakley', country: 'USA', createdAt: now, updatedAt: now })
		.returning();

	// ── 2. Suppliers ────────────────────────────────────────────────────
	console.log('🏭 Creating suppliers...');
	const [supplierLab] = await db
		.insert(schema.suppliers)
		.values({
			name: 'Óptica Lab VE',
			type: 'LABORATORY',
			primaryPhone: '0412-1234567',
			email: 'contacto@opticalab.ve',
			defaultCurrency: 'USD_BCV',
			notes: 'Laboratorio principal de lentes oftálmicos',
			createdAt: now,
			updatedAt: now
		})
		.returning();

	const [supplierDist] = await db
		.insert(schema.suppliers)
		.values({
			name: 'Distribuidora Visión Plus',
			type: 'DISTRIBUTOR',
			primaryPhone: '0414-9876543',
			email: 'ventas@visionplus.com',
			defaultCurrency: 'USD_BCV',
			notes: 'Distribuidor de monturas y accesorios',
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// ── 3. Supplier Treatments ──────────────────────────────────────────
	console.log('💊 Creating supplier treatments...');
	await db.insert(schema.supplierTreatments).values([
		{
			supplierId: supplierLab.id,
			name: 'AR Angel',
			category: 'AR',
			price: 15,
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			supplierId: supplierLab.id,
			name: 'AR Premium',
			category: 'AR',
			price: 25,
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			supplierId: supplierLab.id,
			name: 'Bluecut Standard',
			category: 'BLUECUT',
			price: 8,
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			supplierId: supplierLab.id,
			name: 'Bluecut Premium',
			category: 'BLUECUT',
			price: 18,
			isActive: true,
			createdAt: now,
			updatedAt: now
		}
	]);

	// ── 4. Lens Materials ───────────────────────────────────────────────
	console.log('🔬 Creating lens materials...');
	const [matCR39] = await db
		.insert(schema.lensMaterials)
		.values({
			name: 'CR-39',
			code: 'CR39',
			refractiveIndex: 1.5,
			description: 'Resina estándar',
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	const [matPoly] = await db
		.insert(schema.lensMaterials)
		.values({
			name: 'Policarbonato',
			code: 'POLY',
			refractiveIndex: 1.59,
			description: 'Resistente a impactos, liviano',
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// ── 5. Lens Catalog Items ───────────────────────────────────────────
	console.log('👓 Creating lens catalog items...');
	await db.insert(schema.lensCatalogItems).values([
		{12
			source: 'LAB',
			supplierId: supplierLab.id,
			name: 'Monofocal CR-39 LAB',
			type: 'MONOFOCAL',
			materialId: matCR39.id,
			hasAr: false,
			hasBluecut: false,
			isPhotochromic: false,
			priceType: 'UNIT',
			basePrice: 12,
			salePrice: 30,
			mountingPrice: 5,
			shippingPrice: 3,
			notes: 'Monofocal básico de laboratorio',
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			source: 'LAB',
			supplierId: supplierLab.id,
			name: 'Progresivo Poli LAB',
			type: 'PROGRESSIVE',
			materialId: matPoly.id,
			hasAr: false,
			hasBluecut: false,
			isPhotochromic: false,
			priceType: 'UNIT',
			basePrice: 35,
			salePrice: 85,
			mountingPrice: 8,
			shippingPrice: 3,
			notes: 'Progresivo policarbonato de laboratorio',
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			source: 'FINISHED',
			supplierId: supplierDist.id,
			name: 'Monofocal FINISHED con AR',
			type: 'MONOFOCAL',
			materialId: matCR39.id,
			hasAr: true,
			hasBluecut: false,
			isPhotochromic: false,
			priceType: 'PAIR',
			basePrice: 20,
			salePrice: 45,
			mountingPrice: 0,
			shippingPrice: 2,
			stock: 10,
			notes: 'Cristal terminado con AR incluido',
			isActive: true,
			createdAt: now,
			updatedAt: now
		}
	]);

	// ── 6. Materials (for frames/accessories) ───────────────────────────
	console.log('🪵 Creating product materials...');
	const [matAcetate] = await db
		.insert(schema.materials)
		.values({
			name: 'Acetato',
			code: 'ACE',
			productType: 'FRAME',
			description: 'Acetato de celulosa',
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	const [matMetal] = await db
		.insert(schema.materials)
		.values({
			name: 'Metal',
			code: 'MET',
			productType: 'FRAME',
			description: 'Aleación metálica',
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	const [matMicrofiber] = await db
		.insert(schema.materials)
		.values({
			name: 'Microfibra',
			code: 'MFB',
			productType: 'ACCESSORY',
			description: 'Tela de microfibra para limpieza',
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// ── 7. Products ─────────────────────────────────────────────────────
	console.log('📦 Creating products...');
	await db.insert(schema.products).values([
		{
			sku: 'RB-5228-2000',
			name: 'Ray-Ban RB5228',
			type: 'FRAME',
			brandId: brandRayBan.id,
			supplierId: supplierDist.id,
			color: 'Negro',
			size: '53',
			gender: 'UNISEX',
			materialId: matAcetate.id,
			purchasePrice: 45,
			purchaseCurrency: 'USD_BCV',
			salePrice: 85,
			stock: 5,
			minStock: 2,
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			sku: 'OX-8046-0157',
			name: 'Oakley Airdrop OX8046',
			type: 'FRAME',
			brandId: brandOakley.id,
			supplierId: supplierDist.id,
			color: 'Gris Satinado',
			size: '57',
			gender: 'MALE',
			materialId: matMetal.id,
			purchasePrice: 55,
			purchaseCurrency: 'USD_BCV',
			salePrice: 95,
			stock: 3,
			minStock: 1,
			isActive: true,
			createdAt: now,
			updatedAt: now
		},
		{
			sku: 'ACC-PAÑO-001',
			name: 'Paño limpia lentes',
			type: 'ACCESSORY',
			supplierId: supplierDist.id,
			materialId: matMicrofiber.id,
			purchasePrice: 1,
			purchaseCurrency: 'USD_BCV',
			salePrice: 3,
			stock: 20,
			minStock: 5,
			isActive: true,
			createdAt: now,
			updatedAt: now
		}
	]);

	// ── 8. Customer ─────────────────────────────────────────────────────
	console.log('👤 Creating demo customer...');
	await db.insert(schema.customers).values({
		firstName: 'María',
		lastName: 'González',
		idNumber: 'V-12345678',
		primaryPhone: '0412-5551234',
		email: 'maria.gonzalez@email.com',
		address: 'Av. Libertador, Caracas',
		createdAt: now,
		updatedAt: now
	});

	console.log('\n✅ Demo data seeded successfully!');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('   Brands:       Ray-Ban, Oakley');
	console.log('   Suppliers:    Óptica Lab VE (lab), Distribuidora Visión Plus (dist)');
	console.log('   Treatments:   AR Angel, AR Premium, Bluecut Standard, Bluecut Premium');
	console.log('   Lens Materials: CR-39, Policarbonato');
	console.log('   Lens Catalog: 2 LAB items + 1 FINISHED');
	console.log('   Products:     2 frames + 1 accessory');
	console.log('   Customer:     María González');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	await client.end();
}

main().catch((error) => {
	console.error('❌ Seed failed:', error);
	process.exit(1);
});
