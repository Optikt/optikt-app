import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		csrf: {
			trustedOrigins: ['https://nanezx-elitebook.taild8f0b9.ts.net']
		},
		experimental: {
			remoteFunctions: true,
			instrumentation: {
				server: true
			}
		}
	},

	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
