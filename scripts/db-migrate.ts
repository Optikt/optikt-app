/**
 * Hash-based migration runner.
 *
 * drizzle-kit `migrate` only applies migrations whose journal `when`
 * is newer than the last `created_at` recorded in `__drizzle_migrations`.
 * This repo's journal carries hand-written future `when` timestamps
 * (0036/0037/0038), so locally-generated migrations are silently skipped
 * on any DB restored from an environment that recorded those timestamps.
 *
 * This runner ignores timestamps entirely: it applies every journal entry
 * whose SQL sha256 is not yet recorded in `drizzle.__drizzle_migrations`,
 * in journal order, inside a transaction. Safe on any DB lineage
 * (prod, docker, restored dumps).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

const ROOT = resolve(import.meta.dirname, '..');

function loadEnvFile(filePath: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const line of readFileSync(filePath, 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[match[1]] = value;
	}
	return env;
}

function getDatabaseUrl(): string {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	for (const file of ['.env', '.env.local', '.env.development']) {
		const path = resolve(ROOT, file);
		if (existsSync(path)) {
			const parsed = loadEnvFile(path);
			if (parsed.DATABASE_URL) return parsed.DATABASE_URL;
		}
	}
	throw new Error('DATABASE_URL no está definida (ni en env ni en .env)');
}

interface JournalEntry {
	idx: number;
	tag: string;
	when: number;
	breakpoints: boolean;
}

async function main() {
	const url = getDatabaseUrl();
	const sql = postgres(url, { max: 1 });

	try {
		const journal = JSON.parse(
			readFileSync(resolve(ROOT, 'drizzle/meta/_journal.json'), 'utf8')
		) as { entries: JournalEntry[] };

		await sql.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');
		await sql.unsafe(`
			CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`);

		const recorded = await sql`select hash from drizzle.__drizzle_migrations`;
		const appliedHashes = new Set(recorded.map((r) => String(r.hash)));

		const pending: { entry: JournalEntry; statements: string[]; hash: string }[] = [];

		for (const entry of journal.entries) {
			const filePath = resolve(ROOT, `drizzle/${entry.tag}.sql`);
			if (!existsSync(filePath)) {
				throw new Error(`No file ${entry.tag}.sql found in drizzle folder`);
			}
			const content = readFileSync(filePath, 'utf8');
			const hash = createHash('sha256').update(content).digest('hex');
			if (appliedHashes.has(hash)) continue;
			const statements = content
				.split('--> statement-breakpoint')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			pending.push({ entry, statements, hash });
		}

		if (pending.length === 0) {
			console.log('No migrations to apply — database is up to date.');
			return;
		}

		for (const { entry, statements, hash } of pending) {
			console.log(`Applying ${entry.tag} (${statements.length} statement(s))...`);
			await sql.begin(async (tx) => {
				for (const statement of statements) {
					await tx.unsafe(statement);
				}
				await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${Date.now()})`;
			});
			console.log(`  ✓ ${entry.tag} applied`);
		}

		console.log('Migration run finished.');
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
