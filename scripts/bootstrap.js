// Database bootstrap: applies migrations and seeds the initial admin user.
// Safe to run on every container start — it's idempotent.
//
// Requirements: only production dependencies (postgres, drizzle-orm, @node-rs/argon2).
// Runs as plain ESM so no tsx / ts-node is required in the runtime image.

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ADMIN = {
	email: 'optikt.vision@gmail.com',
	username: 'optikt',
	password: 'Admin_123',
	fullName: 'Optikt Admin',
	role: 'ADMIN'
};

const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = resolve(__dirname, '..', 'drizzle');

async function waitForDatabase(url, { retries = 30, delayMs = 1000 } = {}) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		const probe = postgres(url, { max: 1, onnotice: () => {} });
		try {
			await probe`select 1`;
			await probe.end({ timeout: 5 });
			return;
		} catch (err) {
			await probe.end({ timeout: 5 }).catch((e) => {
				console.log('waitForDatabase probe end');
				console.log(e);
			});
			if (attempt === retries) throw err;
			console.log(`⏳ Database not ready (attempt ${attempt}/${retries})…`);
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}
}

async function runMigrations(url) {
	// Migrator uses its own short-lived connection with max:1.
	const migrationClient = postgres(url, { max: 1, onnotice: () => {} });
	try {
		const db = drizzle(migrationClient);
		console.log('📦 Applying database migrations…');
		await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
		console.log('✅ Migrations applied.');
	} finally {
		await migrationClient.end({ timeout: 5 });
	}
}

async function ensureAdmin(url) {
	const sql = postgres(url, { onnotice: () => {} });
	try {
		const existing = await sql`
			select id from users where email = ${ADMIN.email} limit 1
		`;

		if (existing.length > 0) {
			console.log('ℹ️  Admin user already present, skipping seed.');
			return;
		}

		console.log('🔐 Hashing admin password…');
		const hashedPassword = await hash(ADMIN.password, ARGON2_OPTIONS);

		console.log('👤 Creating admin user…');
		const [user] = await sql`
			insert into users (
				email, username, full_name, hashed_password,
				is_active, is_superuser, role
			) values (
				${ADMIN.email},
				${ADMIN.username.toLowerCase()},
				${ADMIN.fullName},
				${hashedPassword},
				true,
				true,
				${ADMIN.role}
			)
			returning id
		`;

		console.log('✅ Admin created successfully.');
		console.log(`   id:       ${user.id}`);
		console.log(`   email:    ${ADMIN.email}`);
		console.log(`   username: ${ADMIN.username}`);
		console.log(`   role:     ${ADMIN.role}`);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

async function main() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error('❌ DATABASE_URL is not set');
		process.exit(1);
	}

	console.log('🔌 Waiting for database…');
	await waitForDatabase(url);

	await runMigrations(url);
	await ensureAdmin(url);

	console.log('🚀 Bootstrap complete.');
}

main().catch((err) => {
	console.error('❌ Bootstrap failed:', err);
	process.exit(1);
});
