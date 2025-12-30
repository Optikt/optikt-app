import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';

const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

async function main() {
	// Read DATABASE_URL from process.env (set via --env-file or shell)
	const DATABASE_URL = process.env.DATABASE_URL;

	if (!DATABASE_URL) {
		console.error('❌ DATABASE_URL is not set in environment');
		console.log('   Run with: DATABASE_URL="your_url" pnpm tsx scripts/seed-db.ts');
		console.log('   Or use:   source .env && pnpm tsx scripts/seed-db.ts');
		process.exit(1);
	}

	console.log('🔌 Connecting to database...');
	const client = postgres(DATABASE_URL);
	const db = drizzle(client, { schema });

	const email = 'optikt.vision@gmail.com';
	const username = 'optikt';
	const password = 'SuperAdmin_123';
	const fullName = 'Optikt Admin';

	console.log('🔍 Checking for existing superadmin...');

	// Check if superadmin already exists
	const [existingUser] = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.email, email))
		.limit(1);

	if (existingUser) {
		console.log('⚠️  Superadmin already exists, skipping seed.');
		await client.end();
		return;
	}

	console.log('🔐 Hashing password...');
	const hashedPassword = await hash(password, ARGON2_OPTIONS);

	console.log('👤 Creating superadmin user...');
	const [user] = await db
		.insert(schema.users)
		.values({
			email,
			username: username.toLowerCase(),
			fullName,
			hashedPassword,
			isActive: true,
			isSuperuser: true,
			role: 'SUPERADMIN'
		})
		.returning();

	console.log('\n✅ Superadmin created successfully!');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log(`   ID:       ${user.id}`);
	console.log(`   Email:    ${email}`);
	console.log(`   Username: ${username}`);
	console.log(`   Role:     SUPERADMIN`);
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	await client.end();
}

main().catch((error) => {
	console.error('❌ Seed failed:', error);
	process.exit(1);
});
