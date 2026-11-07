<script lang="ts">
	import { Keyboard } from '@lucide/svelte';
	import CountSegmented from './ui/CountSegmented.svelte';
	import StatusIcon from './ui/StatusIcon.svelte';
	import DiffBadge from './ui/DiffBadge.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { finalCount, lineDiff, diffGravity, type CountCycleConfig, type DiffGravity } from '$lib/shared/inventoryCount';
	import type { CountLineRow } from '$lib/server/db/queries/inventoryCount/types';

	interface Props {
		lines: CountLineRow[];
		config: CountCycleConfig;
		costByLineId: Map<number, number | null>;
		canCount: boolean;
		onSaveLine: (lineId: number, value: number) => void;
		onConfirmZero: () => void;
		isMobile: boolean;
		mode: 'ficha' | 'lista';
	}

	let {
		lines,
		config,
		costByLineId,
		canCount,
		onSaveLine,
		onConfirmZero,
		isMobile,
		mode
	}: Props = $props();

	let filter = $state<'ALL' | 'PENDING' | 'WITH_DIFF' | 'ZERO_STOCK'>('ALL');
	let search = $state('');
	let zeroOpen = $state(false);
	let fichaIndex = $state(0);

	const gravityOf = (line: CountLineRow): DiffGravity =>
		diffGravity(line, config, costByLineId.get(line.id) ?? null);
	const query = $derived(search.trim().toLowerCase());
	const passesSearch = (line: CountLineRow): boolean =>
		!query || `${line.itemName} ${line.itemCode ?? ''}`.toLowerCase().includes(query);
	const passesFilter = (line: CountLineRow): boolean => {
		switch (filter) {
			case 'PENDING':
				return line.countedStock == null;
			case 'WITH_DIFF':
				return (lineDiff(line) ?? 0) !== 0;
			case 'ZERO_STOCK':
				return line.systemStock === 0;
			default:
				return true;
		}
	};

	interface BrandGroup {
		name: string;
		counted: number;
		total: number;
		lines: Array<{ line: CountLineRow; index: number }>;
	}

	const brandGroups = $derived.by(
		(): BrandGroup[] => {
			const stock = lines
				.filter((line) => line.systemStock > 0)
				.sort(
					(a, b) => a.brandName.localeCompare(b.brandName) || a.itemName.localeCompare(b.itemName)
				);
			const groups: BrandGroup[] = [];
			for (const line of stock) {
				let group = groups.find((candidate) => candidate.name === line.brandName);
				if (!group) {
					group = { name: line.brandName, counted: 0, total: 0, lines: [] };
					groups.push(group);
				}
				group.lines.push({ line, index: group.lines.length });
				group.total += 1;
				if (line.countedStock != null) group.counted += 1;
			}
			return groups.map((group) => ({
				...group,
				lines: group.lines.filter((item) => passesSearch(item.line) && passesFilter(item.line))
			})).filter((group) => group.lines.length > 0);
		}
	);

	const zeroStock = $derived.by(() => {
		const zeroLines = lines
			.filter((line) => line.systemStock === 0)
			.sort((a, b) => a.itemName.localeCompare(b.itemName))
			.filter((line) => passesSearch(line) && passesFilter(line));
		if (filter === 'ALL' && zeroLines.length === 0) return { lines: [], pending: 0 };
		if (zeroLines.length === 0) return { lines: [], pending: 0 };
		const pending = zeroLines.filter((line) => line.countedStock == null).length;
		return { lines: zeroLines, pending };
	});

	const pendingCount = $derived(lines.filter((line) => line.countedStock == null).length);

	// ── Ficha (teléfono) ─────────────────────────────────────────────────────

	const fichaOrder = $derived.by(() => {
		const withStock = lines.filter((line) => line.systemStock > 0).map((line) => line.id);
		const zero = lines.filter((line) => line.systemStock === 0).map((line) => line.id);
		return [...withStock, ...zero];
	});
	const fichaLine = $derived.by(() => {
		const id = fichaOrder[Math.min(fichaIndex, fichaOrder.length - 1)];
		return lines.find((line) => line.id === id) ?? null;
	});

	function goToNextFicha(): void {
		const currentId = fichaLine?.id;
		if (currentId == null) return;
		const currentPos = fichaOrder.indexOf(currentId);
		const nextPos = fichaOrder.findIndex((id, index) => index > currentPos && lines.find((l) => l.id === id)?.countedStock == null);
		if (nextPos >= 0) fichaIndex = nextPos;
		else if (currentPos < fichaOrder.length - 1) fichaIndex = currentPos + 1;
	}

	function goToPrevFicha(): void {
		fichaIndex = Math.max(0, fichaIndex - 1);
	}

	function saveLine(line: CountLineRow, raw: string): void {
		if (raw == '') return;
		const numeric = Number.parseInt(raw, 10);
		if (!Number.isInteger(numeric) || numeric < 0) return;
		onSaveLine(line.id, numeric);
	}
</script>

<div class="flex flex-col overflow-hidden rounded-xl bg-white shadow-[var(--ds-shadow-md)]">
	<div class="flex flex-wrap items-center gap-2 border-b border-outline-variant/40 px-3 py-2.5">
		<CountSegmented
			value={filter}
			ariaLabel="Filtro de conteo"
			options={[
				{ value: 'ALL', label: 'Todos', tooltip: 'Todos los ítems del conteo' },
				{ value: 'PENDING', label: 'Pendientes', tooltip: 'Los que aún no cuentas' },
				{ value: 'WITH_DIFF', label: 'Con dif.', tooltip: 'Lo que no coincide con el sistema' },
				{ value: 'ZERO_STOCK', label: 'Stock 0', tooltip: 'Ítems con stock 0 en el sistema|Confírmalos en lote; no bloquean el cierre.' }
			]}
			onchange={(value) => {
				filter = value as typeof filter;
				if (filter === 'ZERO_STOCK') zeroOpen = true;
			}}
		/>
		<input
			bind:value={search}
			placeholder="Buscar nombre o SKU"
			data-count-search
			class="min-w-[170px] flex-1 rounded-lg border border-outline-variant/40 bg-white px-3 py-1.5 text-sm"
			aria-label="Buscar ítem"
		/>
		<span class="text-xs text-on-surface-variant">{pendingCount} pendiente{pendingCount === 1 ? '' : 's'}</span>
		{#if !isMobile}
			<TriggerTooltip title="Atajos de teclado" text="↑ ↓ mover · Enter guardar y pasar al siguiente · Esc deshacer · / buscar">
				{#snippet trigger({ props })}
					<span
						{...props}
						tabindex="0"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-brand-navy"
					>
						<Keyboard class="h-4 w-4" />
					</span>
				{/snippet}
			</TriggerTooltip>
		{/if}
	</div>

	{#if isMobile && mode === 'ficha'}
		{#if fichaLine}
			<div class="px-4 py-8 text-center">
				<p class="text-xs font-bold uppercase tracking-[0.06em] text-on-surface-variant">
					{fichaLine.brandName} · ficha {Math.min(fichaIndex + 1, fichaOrder.length)} de {fichaOrder.length}
				</p>
				<p class="mt-1 font-heading text-2xl font-bold text-brand-navy">{fichaLine.itemName}</p>
				<p class="font-mono text-xs text-outline">{fichaLine.itemCode ?? ''}</p>
				<p class="mt-6 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">Sistema</p>
				<p class="font-heading text-[56px] font-bold leading-none text-brand-navy">{fichaLine.systemStock}</p>
				<p class="mt-4 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">Contado</p>
				<input
					type="text"
					inputmode="numeric"
					enterkeyhint="next"
					aria-label="Contado {fichaLine.itemName}"
					value={finalCount(fichaLine) ?? ''}
					disabled={!canCount}
					class="mt-1 mx-auto block w-40 rounded-xl border border-outline-variant/40 bg-white px-3 py-3 text-center text-4xl font-bold"
					oninput={(event) => {
						const input = event.currentTarget as HTMLInputElement;
						input.value = input.value.replace(/\D/g, '').slice(0, 4);
					}}
					onchange={(event) => saveLine(fichaLine, (event.currentTarget as HTMLInputElement).value)}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							saveLine(fichaLine, (event.currentTarget as HTMLInputElement).value);
							goToNextFicha();
						}
					}}
				/>
				<div class="mt-4 flex gap-3 px-4">
					<button
						type="button"
						class="flex-1 rounded-lg bg-surface-container py-3.5 text-sm font-semibold text-brand-navy"
						onclick={goToPrevFicha}
					>
						← Anterior
					</button>
					<button
						type="button"
						class="flex-1 rounded-lg bg-brand-gold py-3.5 text-sm font-semibold text-brand-navy"
						onclick={() => goToNextFicha()}
					>
						Guardar y siguiente
					</button>
				</div>
			</div>
		{:else}
			<p class="p-10 text-center text-sm text-on-surface-variant">Sin ítems en la ficha</p>
		{/if}
	{:else}
		<div class="max-h-[520px] overflow-auto">
			<table class="w-full table-fixed text-sm">
				<thead class="sticky top-0 z-10 bg-surface-container-high text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
					<tr>
						<th class="px-2 text-left font-semibold">Ítem</th>
						<th class="px-2 text-right font-semibold">
							<TriggerTooltip title="Stock del sistema" text="Es una foto al abrir el conteo: no cambia aunque haya ventas durante el conteo.">
								{#snippet trigger({ props })}
									<span {...props} tabindex="0">Sistema</span>
								{/snippet}
							</TriggerTooltip>
						</th>
						<th class="px-2 text-right font-semibold">
							<TriggerTooltip title="Contado" text="Escribe y pulsa Enter para guardar y pasar al siguiente.">
								{#snippet trigger({ props })}
									<span {...props} tabindex="0">Contado</span>
								{/snippet}
							</TriggerTooltip>
						</th>
						<th class="px-2 text-right font-semibold">
							<TriggerTooltip title="Diferencia" text="Contado menos sistema. Ámbar bajo el umbral, rojo sobre el umbral.">
								{#snippet trigger({ props })}
									<span {...props} tabindex="0">Dif.</span>
								{/snippet}
							</TriggerTooltip>
						</th>
					</tr>
				</thead>
			</table>
			<div class="divide-y divide-outline-variant/40">
				{#each brandGroups as brandGroup (brandGroup.name)}
					<div class="sticky top-0 z-[9] bg-surface-container-low px-3 py-1 font-bold uppercase tracking-[0.06em] text-xs text-on-surface-variant">
						{brandGroup.name} · {brandGroup.counted}/{brandGroup.total}
					</div>
					{#each brandGroup.lines as item (item.line.id)}
						{@const line = item.line}
						{@const final = finalCount(line)}
						{@const diff = lineDiff(line)}
						<div class="grid grid-cols-[26px_1fr_70px_110px_110px] items-center gap-2.5 border-t border-outline-variant/40 px-3 py-2.5 transition-colors focus-within:bg-info-container">
							<StatusIcon line={line} diffThresholdUnits={config.diffThresholdUnits} diffThresholdUsd={config.diffThresholdUsd} unitCost={costByLineId.get(line.id) ?? null} />
							<span class="flex min-w-0 flex-col">
								<span class="truncate text-sm font-medium text-brand-navy" title={line.itemName}>{line.itemName}</span>
								{#if line.notes}
									<span class="text-xs text-on-surface-variant">{line.notes}</span>
								{:else}
									<span class="truncate font-mono text-xs text-outline">{line.itemCode ?? ''}</span>
								{/if}
							</span>
							<span class="text-right tabular-nums text-brand-navy">{line.systemStock}</span>
							<input
								type="text"
								inputmode="numeric"
								aria-label="Contado {line.itemName}"
								value={final ?? ''}
								disabled={!canCount}
								class="w-24 rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-right font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
								oninput={(event) => {
									const input = event.currentTarget as HTMLInputElement;
									input.value = input.value.replace(/\D/g, '').slice(0, 4);
								}}
								onchange={(event) => saveLine(line, (event.currentTarget as HTMLInputElement).value)}
								onkeydown={(event) => {
									const input = event.currentTarget as HTMLInputElement;
									if (event.key === 'Enter') {
										event.preventDefault();
										saveLine(line, input.value);
									} else if (event.key === 'Escape') {
										event.preventDefault();
										input.value = String(final ?? '');
										input.blur();
									}
									// ↑ ↓ teclas gestionadas por el navegador (navegan naturalmente entre inputs).
								}}
							/>
							<div class="text-right">
								{#if line.countedStock != null && diff !== 0}
									<DiffBadge
										diff={diff}
										gravity={gravityOf(line)}
										systemStock={line.systemStock}
										counted={finalCount(line)}
										stateTitle={gravityOf(line) === 'high' ? (diff! > 0 ? `Sobran ${diff}` : `Falta ${Math.abs(diff!)}`) : 'Diferencia baja'}
										textual
									/>
								{:else}
									<span>—</span>
								{/if}
							</div>
						</div>
					{/each}
				{/each}

				{#if zeroStock.lines.length > 0}
					<div class="sticky top-0 z-[9] flex items-center justify-between bg-surface-container-low px-3 py-1 font-bold uppercase tracking-[0.06em] text-xs text-on-surface-variant">
						<button
							type="button"
							class="flex items-center gap-2"
							onclick={() => (zeroOpen = !zeroOpen)}
							aria-expanded={zeroOpen}
						>
							<span>{zeroOpen ? '▾' : '▸'}</span>
							Stock 0 · {zeroStock.lines.length} ítems
						</button>
						<button
							type="button"
							class="rounded bg-brand-navy px-2 py-0.5 text-xs text-white"
							disabled={zeroStock.pending === 0}
							onclick={onConfirmZero}
						>
							Confirmar los {zeroStock.pending} en 0
						</button>
					</div>
					{#if zeroOpen || filter === 'ZERO_STOCK'}
						{#each zeroStock.lines as line (line.id)}
							{@const diff = lineDiff(line)}
							<div class="grid grid-cols-[26px_1fr_70px_110px_110px] items-center gap-2.5 border-t border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5">
								<StatusIcon line={line} diffThresholdUnits={config.diffThresholdUnits} diffThresholdUsd={config.diffThresholdUsd} unitCost={null} />
								<span class="truncate text-sm font-medium text-brand-navy">{line.itemName}</span>
								<span class="text-right tabular-nums text-brand-navy">{line.systemStock}</span>
								<input
									type="text"
									inputmode="numeric"
									aria-label="Contado {line.itemName}"
									value={line.countedStock ?? ''}
									disabled={!canCount}
									class="w-24 rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-right font-semibold tabular-nums focus:ring-2 focus:ring-brand-blue/50 focus:outline-none"
									oninput={(event) => {
										const input = event.currentTarget as HTMLInputElement;
										input.value = input.value.replace(/\D/g, '').slice(0, 4);
									}}
									onchange={(event) => saveLine(line, (event.currentTarget as HTMLInputElement).value)}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											saveLine(line, (event.currentTarget as HTMLInputElement).value);
										}
									}}
								/>
								<div class="text-right">
									{#if line.countedStock != null && diff !== 0}
										<DiffBadge
											diff={diff}
											gravity={gravityOf(line)}
											systemStock={line.systemStock}
											counted={finalCount(line)}
											stateTitle="Diferencia frente al sistema"
										/>
									{:else}
										<span>—</span>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				{/if}

				{#if brandGroups.length === 0 && zeroStock.lines.length === 0}
					<div class="px-6 py-10 text-center text-sm text-on-surface-variant">
						<b class="text-brand-navy">Sin resultados</b>
						<span class="block">Prueba otra búsqueda o cambia el filtro</span>
					</div>
				{/if}
	{/if}
</div>
