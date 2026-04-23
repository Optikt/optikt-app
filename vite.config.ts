import { sentrySvelteKit } from '@sentry/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			org: 'optikt',
			project: 'javascript-sveltekit'
		}),
		tailwindcss(),
		sveltekit()
	],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		allowedHosts: ['elitebook.taild8f0b9.ts.net', 'nanezx-elitebook.taild8f0b9.ts.net'],
		watch: {
			ignored: ['**/PLAN.md', '**/AGENTS.md', '**/docs/**', '**/plans/**', '**/drizzle/**']
		}
	},

	test: {
		expect: { requireAssertions: true },

		projects: [
			{
				extends: './vite.config.ts',

				test: {
					name: 'client',

					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},

					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
