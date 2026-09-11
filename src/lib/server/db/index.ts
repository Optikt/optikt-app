import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const DATABASE_URL = env.DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const globalForDb = globalThis as unknown as {
	client?: ReturnType<typeof postgres>;
	db?: ReturnType<typeof drizzle>;
};

if (!globalForDb.client) {
	globalForDb.client = postgres(DATABASE_URL, { connection: { timezone: 'UTC' } });
	globalForDb.db = drizzle(globalForDb.client, { schema });
}

export const db = globalForDb.db!;
