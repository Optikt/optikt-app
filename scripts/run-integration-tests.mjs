// Starts an ephemeral Postgres container and runs the integration test project.
// Must start the container BEFORE Vitest loads the Vite config: SvelteKit inlines
// `$env/dynamic/private` from .env at config time, so DATABASE_URL must already be
// in process.env for the app `db` singleton to point at the container.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const container = await new PostgreSqlContainer('postgres:16').start();
const url = container.getConnectionUri();
process.env.DATABASE_URL = url;

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
	await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'drizzle') });
} finally {
	await client.end({ timeout: 5 });
}

const child = spawn(
	process.execPath,
	['node_modules/vitest/vitest.mjs', '--run', '--project=integration'],
	{
		stdio: 'inherit',
		env: process.env
	}
);

let stopping = false;
async function shutdown(code) {
	if (stopping) return;
	stopping = true;
	await container.stop();
	process.exit(code);
}

child.on('exit', (code) => {
	void shutdown(code ?? 1);
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
