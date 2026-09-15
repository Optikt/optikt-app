import postgres from 'postgres';

function testClient() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set for integration tests');
	return postgres(url, { max: 1, onnotice: () => {} });
}

export async function resetDb(): Promise<void> {
	const sql = testClient();
	try {
		const tables = await sql<{ tablename: string }[]>`
			select tablename from pg_tables where schemaname = 'public'
		`;
		if (tables.length === 0) return;
		const list = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
		await sql.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
	} finally {
		await sql.end({ timeout: 5 });
	}
}
