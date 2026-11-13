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
			reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: [
				'src/lib/server/**',
				'src/lib/remote/**',
				'src/lib/shared/**',
				'src/lib/schemas/**',
				'src/lib/components/inventory/count/*.ts',
				'src/lib/components/documentEditor/**/*.ts',
				'src/lib/components/sales/editSale/editSaleLensAdapter.ts',
				'src/lib/components/sales/editSaleDraft.ts',
				'src/lib/components/sales/editSaleValidation.ts',
				'src/lib/components/sales/detail/facturaCalculator.ts',
				'src/lib/components/sales/detail/saleBreakdown.ts',
				'src/lib/components/sales/detail/saleDetail.ts',
				'src/lib/components/sales/itemsTable/costTotals.ts',
				'src/lib/components/sales/itemsTable/itemDisplay.ts',
				'src/lib/components/sales/listParams.ts',
				'src/lib/components/sales/saleDisplay.ts',
				'src/lib/components/sales/payments/paymentFormValues.ts',
				'src/lib/components/sales/payments/paymentFormDerived.ts',
				'src/lib/components/sales/payments/purchasePayment.ts',
				'src/lib/components/sales/payments/purchaseOrderProntoPago.ts',
				'src/lib/utils/format.ts',
				'src/lib/utils/index.ts',
				'src/lib/utils/inventory.ts',
				'src/lib/utils/saleDetail.ts',
				'src/lib/components/ui/chart/chart-utils.ts'
			],
			thresholds: {
				lines: 24,
				statements: 23,
				functions: 21,
				branches: 15,
				'src/lib/server/payments/**': { lines: 88 },
				'src/lib/server/inventory/**': { lines: 80 },
				'src/lib/components/sales/payments/paymentFormValues.ts': { lines: 80 }
			}
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

					setupFiles: ['vitest-browser-svelte'],

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
