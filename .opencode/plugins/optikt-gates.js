// optikt-gates — plugin local de OpenCode V2.
// Contrato: API de plugins de OpenCode 2 — `default export { id, setup }`
// (https://opencode.ai/v2/docs/build/plugins/migrate-v1).
//
// POR QUÉ EXISTE
// El gate real del repo es `pnpm check` + `eslint` + los proyectos de vitest, pero
// elegir el subconjunto correcto según lo que cambió es tedioso y se olvida.
// Este plugin expone `optikt_verify`: corre el gate MÍNIMO sobre los archivos
// cambiados y devuelve PASS/FAIL por gate con el error al final, en una sola
// llamada en vez de encadenar comandos.

import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 15 * 60 * 1000;
const MAX_BUFFER = 32 * 1024 * 1024;
const TAIL_LINES = 40;

const CODE_FILE = /\.(ts|js|svelte)$/;
const TEST_FILE = /\.(spec|test)\.(ts|js)$/;

/** Últimas líneas de la salida, sin colores ANSI. */
function tail(text, lines = TAIL_LINES) {
	const all = String(text ?? '')
		// eslint-disable-next-line no-control-regex
		.replace(/\u001b\[[0-9;]*m/g, '')
		.trimEnd()
		.split('\n')
		.filter((line) => line.length > 0);
	if (all.length <= lines) return all.join('\n');
	return `… (${all.length - lines} líneas omitidas)\n${all.slice(-lines).join('\n')}`;
}

/** Comilla simple segura para bash. */
function quote(value) {
	return `'${String(value).replaceAll("'", "'\\''")}'`;
}

/** `bash -lc` para heredar el PATH del usuario (nvm/pnpm). */
async function shell(cwd, command) {
	try {
		const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
			cwd,
			timeout: TIMEOUT_MS,
			maxBuffer: MAX_BUFFER
		});
		return { ok: true, out: `${stdout}${stderr}` };
	} catch (error) {
		return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}` };
	}
}

/** ¿La ruta es un archivo real dentro del proyecto? */
function isFile(cwd, path) {
	try {
		return statSync(resolve(cwd, path)).isFile();
	} catch {
		return false;
	}
}

/**
 * Archivos cambiados según git; `null` si no es un repo git.
 * `--untracked-files=all` lista los archivos dentro de carpetas nuevas (por
 * defecto git solo devuelve la carpeta), y se descartan los borrados.
 */
async function changedFiles(cwd) {
	const { ok, out } = await shell(cwd, 'git status --porcelain --untracked-files=all');
	if (!ok) return null;
	return [
		...new Set(
			out
				.split('\n')
				.map((line) => line.slice(3).trim())
				.filter(Boolean)
				.flatMap((entry) => entry.split(' -> ').map((path) => path.trim()))
		)
	].filter((path) => isFile(cwd, path));
}

export default {
	id: 'optikt-gates',

	async setup(ctx) {
		const cwd = ctx.location?.directory ?? process.cwd();

		await ctx.tool.transform((editor) => {
			editor.namespace({
				name: 'optikt',
				description: 'Gates de verificación del repo optikt-app'
			});

			editor.add({
				name: 'verify',
				description:
					'Corre el gate mínimo del repo sobre los archivos cambiados: eslint + svelte-check + los proyectos de vitest afectados. Devuelve PASS/FAIL por gate con el error al final. Úsalo antes de dar por terminado un cambio.',
				input: {
					type: 'object',
					properties: {
						files: {
							type: 'array',
							items: { type: 'string' },
							description: 'Rutas a verificar. Por defecto, las cambiadas según `git status --porcelain`.'
						},
						full: {
							type: 'boolean',
							description:
								'Correr todos los tests unitarios (`pnpm test:unit`) en vez de solo los proyectos afectados.'
						}
					},
					additionalProperties: false
				},
				options: { namespace: 'optikt', codemode: true },

				async execute(input, context) {
					const requested = Array.isArray(input?.files) && input.files.length > 0 ? input.files : null;
					const files = (requested ?? (await changedFiles(cwd)))?.filter((file) => isFile(cwd, file)) ?? null;

					if (files === null) {
						return { content: 'No pude leer `git status` (¿la ruta del proyecto no es un repo git?).' };
					}
					if (files.length === 0) {
						return { content: 'No hay archivos cambiados. Pasa `files` para verificar rutas concretas.' };
					}

					const code = files.filter((file) => CODE_FILE.test(file));
					const tests = files.filter((file) => TEST_FILE.test(file));
					const touchesServer = files.some(
						(file) =>
							file.startsWith('src/lib/server/') ||
							file.startsWith('src/lib/remote/') ||
							file.startsWith('src/lib/shared/') ||
							file.startsWith('src/lib/schemas/') ||
							/\+.*\.server\.ts$/.test(file)
					);
					const touchesClient = files.some(
						(file) =>
							file.endsWith('.svelte') ||
							file.startsWith('src/lib/components/') ||
							file.startsWith('src/routes/')
					);

					const gates = [];

					await context?.progress?.({ status: 'eslint' });
					if (code.length > 0) {
						const result = await shell(cwd, `pnpm exec eslint ${code.map(quote).join(' ')}`);
						gates.push({ name: `eslint (${code.length} archivo(s))`, ...result });
					} else {
						gates.push({ name: 'eslint', ok: true, out: 'sin archivos .ts/.js/.svelte cambiados' });
					}

					await context?.progress?.({ status: 'svelte-check' });
					if (code.length > 0) {
						gates.push({ name: 'svelte-check (pnpm check)', ...(await shell(cwd, 'pnpm check')) });
					} else {
						gates.push({ name: 'svelte-check (pnpm check)', ok: true, out: 'sin archivos de código cambiados' });
					}

					await context?.progress?.({ status: 'vitest' });
					if (tests.length > 0) {
						gates.push({
							name: `vitest (${tests.length} prueba(s) tocada(s))`,
							...(await shell(cwd, `pnpm exec vitest --run ${tests.map(quote).join(' ')}`))
						});
					} else if (input?.full === true) {
						gates.push({ name: 'vitest (unit completo)', ...(await shell(cwd, 'pnpm test:unit')) });
					} else {
						const projects = [touchesServer ? 'server' : null, touchesClient ? 'client' : null].filter(Boolean);
						if (projects.length === 0) {
							gates.push({ name: 'vitest', ok: true, out: 'sin proyecto afectado' });
						} else {
							const flags = projects.map((project) => `--project=${project}`).join(' ');
							gates.push({ name: `vitest (${projects.join('+')})`, ...(await shell(cwd, `pnpm exec vitest --run ${flags}`)) });
						}
					}

					const report = gates
						.map(({ name, ok, out }) => `[${ok ? 'PASS' : 'FAIL'}] ${name}\n${tail(out) || '(sin salida)'}`)
						.join('\n\n');
					const failed = gates.filter((gate) => !gate.ok).length;
					const summary = `optikt_verify — ${files.length} archivo(s) cambiado(s) · ${gates.length - failed} PASS / ${failed} FAIL`;

					return { content: `${summary}\n\n${report}` };
				}
			});
		});
	}
};
