#!/usr/bin/env node
/**
 * check-agents-docs.mjs — Aviso de sincronización entre dominios de código y su AGENTS.md.
 *
 * Fuente única de mapeo: scripts/agents-domains.json
 *
 * Modos:
 *   node scripts/check-agents-docs.mjs <base>        Diff contra <base> (ej: origin/main). En CI usa env GITHUB_BASE_REF.
 *   node scripts/check-agents-docs.mjs --selftest    Verifica el mapeo con fixtures + valida estructura del JSON.
 *   node scripts/check-agents-docs.mjs --coverage    Lista archivos src/** que no caen en ningún dominio.
 *
 * Comportamiento en CI: SIEMPRE exit 0 salvo crash; emite ::warning:: annotations de GitHub.
 * Advertencia (warning) ≠ errores de bloqueo (error/ bloqueo): este check es un recordatorio, no un gate.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = path.join(repoRoot, 'scripts/agents-domains.json');

/** Convierte un glob estilo git-ignore a RegExp. `*` no cruza `/`; `**` cruza todo. */
function globToRegex(glob) {
	let re = '';
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i];
		if (c === '*') {
			if (glob[i + 1] === '*') {
				re += '.*';
				i++;
			} else {
				re += '[^/]*';
			}
		} else if ('\\^$.|+()[]{}?'.includes(c)) {
			re += '\\' + c;
		} else {
			re += c;
		}
	}
	// Prefijo extendido solo si el glob termina en literal: "src/lib/components/ui" matchea toda la carpeta.
	if (!glob.endsWith('*')) re += '(?:/.*)?';
	return new RegExp('^' + re + '$');
}

/** Puntos de análisis '/' presentes en el patrón, para desempatar patrones por especificidad. */
function specificity(pattern) {
	return (pattern.match(/\//g) ?? []).length + (pattern.includes('**') ? -1 : 0);
}

let domains;
try {
	domains = JSON.parse(readFileSync(INDEX_PATH, 'utf8')).domains;
} catch (err) {
	console.error(`[check-agents-docs] ERROR: no se pudo leer agents-domains.json: ${err.message}`);
	process.exit(1);
}

// Pre-compilar: cada dominio guardará el mejor pattern por glob (colisión por índice).
const compiled = domains.map((d) => ({
	id: d.id,
	hasDoc: existsSync(path.join(repoRoot, 'docs/agents', `${d.id}.md`)),
	matchers: (d.globs ?? []).map((g) => ({ source: g, regex: globToRegex(g), spec: specificity(g) }))
}));

/** Resuelve dominio para una ruta (rutas del repo relativas a la raíz). undefined => 'shared'/no mapeado. */
function matchFile(filePath) {
	let best = { domain: null, spec: -1 };
	for (const d of compiled) {
		for (const m of d.matchers) {
			if (m.regex.test(filePath) && m.spec > best.spec) {
				best = { domain: d, spec: m.spec };
			}
		}
	}
	return best.domain;
}

function listSrcFiles() {
	try {
		return execSync('git ls-files "src/**"', { cwd: repoRoot, encoding: 'utf8' })
			.split('\n')
			.filter(Boolean);
	} catch {
		return [];
	}
}

function gitChangedFiles(base) {
	const range = base.includes('...') ? base : `${base}...HEAD`;
	try {
		return execSync(`git diff --name-only ${range}`, { cwd: repoRoot, encoding: 'utf8' })
			.split('\n')
			.filter(Boolean);
	} catch (err) {
		console.error(
			`[check-agents-docs] No se pudo calcular el diff contra '${base}': ${err.message.trim()}`
		);
		process.exit(1);
	}
}

function warn(msg) {
	console.log(`::warning::${msg}`);
	console.log(`  W: ${msg}`);
}

// ---------------------------------------------------------------- selftest
const FIXTURES = [
	['src/lib/components/sales/PaymentStep.svelte', 'sales'],
	['src/lib/remote/sales/payments.remote.ts', 'sales'],
	['src/lib/server/sales/createSale.ts', 'sales'],
	['src/lib/server/db/queries/sales/writes.ts', 'sales'],
	['src/lib/schemas/sales.ts', 'sales'],
	['src/lib/server/db/schema/sales.ts', 'sales'],
	['src/lib/server/payments/salePayments.ts', 'payments'],
	['src/lib/components/payments/PaymentAmountCard.svelte', 'payments'],
	['src/lib/remote/purchaseOrders/payments.remote.ts', 'purchases'],
	['src/lib/server/db/queries/purchaseOrderPayments.ts', 'purchases'],
	['src/lib/schemas/purchaseOrderCreditSchedule.ts', 'purchases'],
	['src/lib/server/db/queries/cash/expenses.ts', 'cash'],
	['src/lib/remote/inventoryCount.remote.ts', 'inventory'],
	['src/lib/server/inventory/revertFullLot.ts', 'inventory'],
	['src/lib/server/db/queries/fifoConsumption.ts', 'inventory'],
	['src/lib/remote/lenses/catalog.remote.ts', 'lenses'],
	['src/lib/remote/catalog.remote.ts', 'products'],
	['src/lib/server/db/queries/brandAccessories/reads.ts', 'brands'],
	['src/lib/components/accessories/AddIncludedAccessoryDialog.svelte', 'brands'],
	['src/lib/server/db/queries/brandSuppliers.ts', 'suppliers'],
	['src/lib/server/quotes/convertQuoteToSale.ts', 'quotes'],
	['src/lib/server/auth.ts', 'users'],
	['src/routes/(auth)/login/+page.svelte', 'users'],
	['src/lib/server/exchangeRates/poller.ts', 'notifications-rates'],
	['src/routes/(app)/api/exchange-rates/stream/+server.ts', 'notifications-rates'],
	['src/routes/api/internal/backup-webhook/+server.ts', 'backups'],
	['src/routes/api/pdf/sale/[id]/+server.ts', 'printing'],
	['src/routes/(print)/print/sale/[id]/+page.svelte', 'printing'],
	['src/lib/resources/remote/history.remote.ts', null],
	['src/lib/remote/history.remote.ts', 'history'],
	['src/lib/server/db/queries/changeHistory.ts', 'history'],
	['src/routes/(app)/trash/+page.svelte', 'trash'],
	['src/lib/server/db/queries/deletedItems.ts', 'trash'],
	['src/routes/(app)/settings/+page.server.ts', 'settings'],
	['src/lib/schema/settings.ts', null],
	['src/lib/schemas/settings.ts', 'settings'],
	['src/lib/components/ui/Button.svelte', 'shared'],
	['src/lib/components/commercialDocument/PriceQtyFields.svelte', 'shared'],
	['src/lib/actions/tooltip.ts', 'shared'],
	['src/lib/server/audit/auditService.ts', 'shared'],
	['src/lib/server/documentTotals.ts', 'shared']
];

function selftest() {
	const failures = [];
	for (const [file, expected] of FIXTURES) {
		const got = matchFile(file);
		const gotId = got?.id ?? null;
		if (gotId !== expected) {
			failures.push(`✗ ${file}: esperado '${expected}', obtenido '${gotId}'`);
		}
	}
	const ids = new Set(compiled.map((d) => d.id));
	const dupes = compiled.map((d) => d.id).filter((id, i, arr) => arr.indexOf(id) !== i);
	if (dupes.length) failures.push(`✗ IDs duplicados en agents-domains.json: ${dupes.join(', ')}`);
	if (failures.length) {
		console.error(`[check-agents-docs] selftest FALLÓ (${failures.length}/${FIXTURES.length}):`);
		for (const f of failures) console.error('  ' + f);
		process.exit(1);
	}
	console.log(
		`[check-agents-docs] selftest OK (${FIXTURES.length} fixtures) — ${ids.size} dominios.`
	);
	const missingDoc = compiled.filter((d) => !d.hasDoc).map((d) => d.id);
	console.log(
		missingDoc.length
			? `  Con doc: ${ids.size - missingDoc.length}/${ids.size} — sin doc todavía: ${missingDoc.join(', ')}`
			: '  Todos los dominios tienen doc.'
	);
}

// ---------------------------------------------------------------- modos CLI
const argv = process.argv.slice(2);

if (argv.includes('--selftest')) {
	selftest();
	process.exit(0);
}

if (argv.includes('--coverage')) {
	const unmatched = listSrcFiles().filter((f) => !matchFile(f));
	console.log(
		`[check-agents-docs] cobertura: ${(((listSrcFiles().length - unmatched.length) / Math.max(listSrcFiles().length, 1)) * 100).toFixed(1)}% de src cubierta`
	);
	if (unmatched.length) {
		console.log(`SIN dominio (${unmatched.length} archivos):`);
		for (const f of unmatched) console.log('  ' + f);
	}
	process.exit(0);
}

// ---------------------------------------------------------------- diff mode
const base = argv[0] ?? process.env.GITHUB_BASE_REF;
if (!base) {
	console.error(
		'[check-agents-docs] Uso: node scripts/check-agents-docs.mjs <base> | --selftest | --coverage'
	);
	process.exit(1);
}
const dupesRemaining = compiled.map((d) => d.id).filter((id, i, arr) => arr.indexOf(id) !== i);
if (dupesRemaining.length) {
	console.error(
		`[check-agents-docs] ERROR: IDs duplicados en agents-domains.json: ${dupesRemaining.join(', ')}`
	);
	process.exit(1);
}

const changed = gitChangedFiles(base);
const codeChanged = changed.filter((f) => f.startsWith('src/'));
const domainsTouched = new Map();
for (const f of codeChanged) {
	const d = matchFile(f);
	if (d) {
		if (!domainsTouched.has(d.id)) domainsTouched.set(d.id, { hasDoc: d.hasDoc, files: [] });
		domainsTouched.get(d.id).files.push(f);
	}
}
const docsChanged = new Set(
	changed
		.filter((f) => f.startsWith('docs/agents/') && f.endsWith('.md') && !f.includes('_TEMPLATE'))
		.map((f) => path.basename(f, '.md'))
);

for (const [id, info] of domainsTouched) {
	if (!info.hasDoc) {
		warn(
			`Dominio '${id}' tiene archivos cambiados pero no tiene docs/agents/${id}.md — créalo desde docs/agents/_TEMPLATE.md si introduce/cambia reglas de dominio (${info.files.length} archivos).`
		);
	} else if (!docsChanged.has(id)) {
		warn(
			`Dominio '${id}' cambió (${info.files.length} archivos) pero docs/agents/${id}.md no fue tocado en este cambio — si cambiaron reglas de negocio/endpoints, actualízalo (Documentation Sync Rule, ver root AGENTS.md).`
		);
	}
}
console.log(
	`[check-agents-docs] ${codeChanged.length} archivos src/ en diff vs '${base}' → ${domainsTouched.size} dominios tocados.`
);
process.exit(0);
