import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm build && pnpm preview', port: 4173, timeout: 180_000 },
	testDir: 'e2e'
});
