import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		allowedHosts: [
			'elitebook.taild8f0b9.ts.net',
			'nanezx-elitebook.taild8f0b9.ts.net',
			'victor-wsl.taild8f0b9.ts.net'
		],
		watch: {
			ignored: [
				'**/PLAN.md',
				'**/AGENTS.md',
				'**/docs/**',
				'**/plans/**',
				'**/drizzle/**',
				'**/.codebase-memory/**'
			]
		}
	},

	test: {
		expect: { requireAssertions: true },

		coverage: {
			provider: 'v8',
			reporter: ['text-summary', 'json-summary', 'html'],
			reportsDirectory: './coverage',
			include: ['src/lib/server/**', 'src/lib/remote/**', 'src/lib/shared/**', 'src/lib/schemas/**']
		},

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
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.int.spec.ts']
				}
			},

			{
				extends: './vite.config.ts',

				test: {
					name: 'integration',
					environment: 'node',
					include: ['src/**/*.int.spec.ts'],
					pool: 'forks',
					fileParallelism: false,
					testTimeout: 30_000,
					hookTimeout: 120_000
				}
			}
		]
	}
});
