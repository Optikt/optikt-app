// Starts an ephemeral Postgres, applies migrations + admin seed, then runs Playwright.
// DATABASE_URL must be in process.env before Playwright launches the webServer
// (build + preview), so the production server reads it at runtime.
import { spawn } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const container = await new PostgreSqlContainer('postgres:16').start();
process.env.DATABASE_URL = container.getConnectionUri();

function run(entry, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [entry, ...args], { stdio: 'inherit', env: process.env });
		child.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`${entry} exited with code ${code}`))
		);
	});
}

let exitCode = 0;
try {
	await run('scripts/bootstrap.js', []);
	await run('node_modules/playwright/cli.js', ['test', ...process.argv.slice(2)]);
} catch (error) {
	console.error(error.message);
	exitCode = 1;
}

await container.stop();
process.exit(exitCode);
