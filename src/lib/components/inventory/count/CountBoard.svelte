<script lang="ts">
	import { tick } from 'svelte';
	import { Keyboard } from '@lucide/svelte';
	import CountSegmented from './ui/CountSegmented.svelte';
	import StatusIcon from './ui/StatusIcon.svelte';
	import DiffBadge from './ui/DiffBadge.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		finalCount,
		lineDiff,
		diffGravity,
		type CountCycleConfig,
		type DiffGravity
	} from '$lib/shared/inventoryCount';
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

	let { lines, config, costByLineId, canCount, onSaveLine, onConfirmZero, isMobile, mode }: Props =
		$props();

	let filter = $state<'ALL' | 'PENDING' | 'WITH_DIFF' | 'ZERO_STOCK'>('ALL');
	let search = $state('');
	let zeroOpen = $state(false);
	let fichaIndex = $state(0);

	// ── Virtualización (lista de escritorio) ────────────────────────────────

	const ROW_H = 52;
	const GROUP_H = 33;
	const OVERSCAN_ROWS = 10;

	let viewport: HTMLDivElement | undefined = $state();
	let scrollTop = $state(0);
	let viewportHeight = $state(520);

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

	interface VirtualGroup {
		kind: 'group';
		name: string;
		counted: number;
		total: number;
		/** true si es la cabecera colapsable de Stock 0. */
		isZero?: boolean;
	}
	interface VirtualLine {
		kind: 'line';
		line: CountLineRow;
		/** Index global de líneas contadas (para el cursor ↑↓). */
		lineIndex: number;
	}
	type VirtualRow = VirtualGroup | VirtualLine;

	interface PositionedRow {
		row: VirtualRow;
		offset: number;
		height: number;
	}

	interface BrandGroup {
		name: string;
		counted: number;
		total: number;
		lines: CountLineRow[];
	}

	const brandGroups = $derived.by((): BrandGroup[] => {
		const stock = lines
			.filter((line) => line.systemStock > 0)
			.sort(
				(a, b) => a.brandName.localeCompare(b.brandName) || a.itemName.localeCompare(b.itemName)
			);
		const groups: BrandGroup[] = [];
		for (const line of stock) {
			const candidate = groups.find((entry) => entry.name === line.brandName);
			const group: BrandGroup = candidate ?? {
				name: line.brandName,
				counted: 0,
				total: 0,
				lines: []
			};
			if (!candidate) groups.push(group);
			group.lines.push(line);
			group.total += 1;
			if (line.countedStock != null) group.counted += 1;
		}
		return groups
			.map((group) => ({
				...group,
				lines: group.lines.filter((line) => passesSearch(line) && passesFilter(line))
			}))
			.filter((group) => group.lines.length > 0);
	});

	const zeroStock = $derived.by(() => {
		const zeroLines = lines
			.filter((line) => line.systemStock === 0)
			.sort((a, b) => a.itemName.localeCompare(b.itemName))
			.filter((line) => passesSearch(line) && passesFilter(line));
		const pending = zeroLines.filter((line) => line.countedStock == null).length;
		return { lines: zeroLines, pending };
	});

	const pendingCount = $derived(lines.filter((line) => line.countedStock == null).length);

	/**
	 * Lista plana virtualizada: cabeceras de grupo + líneas con su offset.
	 * Las líneas de `systemStock > 0` van primero (por marca); el grupo
	 * colapsado de «Stock 0» al final.
	 */
	const flatRows = $derived.by((): PositionedRow[] => {
		const list: Array<{ row: VirtualRow; height: number }> = [];
		let lineIndex = 0;
		for (const group of brandGroups) {
			list.push({
				row: { kind: 'group', name: group.name, counted: group.counted, total: group.total },
				height: GROUP_H
			});
			for (const line of group.lines) {
				list.push({ row: { kind: 'line', line, lineIndex: lineIndex++ }, height: ROW_H });
			}
		}
		if (zeroStock.lines.length > 0) {
			list.push({
				row: {
					kind: 'group',
					name: 'Stock 0',
					counted: zeroStock.lines.length - zeroStock.pending,
					total: zeroStock.lines.length,
					isZero: true
				},
				height: GROUP_H
			});
			if (zeroOpen || filter === 'ZERO_STOCK') {
				for (const line of zeroStock.lines) {
					list.push({ row: { kind: 'line', line, lineIndex: lineIndex++ }, height: ROW_H });
				}
			}
		}

		let offset = 0;
		return list.map((entry) => {
			const positioned: PositionedRow = { row: entry.row, offset, height: entry.height };
			offset += entry.height;
			return positioned;
		});
	});

	const totalHeight = $derived(
		flatRows.length > 0
			? flatRows[flatRows.length - 1].offset + flatRows[flatRows.length - 1].height
			: 0
	);

	const windowRange = $derived.by(() => {
		if (flatRows.length === 0) return { from: 0, to: 0 };
		const startTarget = scrollTop;
		const endTarget = scrollTop + viewportHeight;
		let from = 0;
		while (from < flatRows.length && flatRows[from].offset + flatRows[from].height <= startTarget) {
			from += 1;
		}
		let to = from;
		while (to < flatRows.length && flatRows[to].offset < endTarget) {
			to += 1;
		}
		return {
			from: Math.max(0, from - OVERSCAN_ROWS),
			to: Math.min(flatRows.length, to + OVERSCAN_ROWS)
		};
	});

	const visibleRows = $derived(flatRows.slice(windowRange.from, windowRange.to));

	const overlayGroup = $derived.by((): VirtualGroup | null => {
		if (flatRows.length === 0) return null;
		// Grupo del primer ítem cuyo rango cruza el borde superior del viewport.
		const target = scrollTop;
		let candidate: VirtualGroup | null = null;
		for (const entry of flatRows) {
			if (entry.row.kind !== 'group') continue;
			if (entry.offset <= target) candidate = entry.row;
			else break;
		}
		return candidate;
	});

	const lineCount = $derived(flatRows.filter((entry) => entry.row.kind === 'line').length);

	function handleScroll(event: Event): void {
		const element = event.currentTarget as HTMLDivElement;
		scrollTop = element.scrollTop;
	}

	function rowKey(entry: PositionedRow): string {
		if (entry.row.kind === 'group') return `g-${entry.row.name}-${entry.offset}`;
		return `l-${entry.row.line.id}`;
	}

	function scrollToOffset(offset: number): void {
		if (!viewport) return;
		viewport.scrollTop = offset;
		scrollTop = offset;
	}

	async function focusLineAtIndex(lineIdx: number): Promise<void> {
		const entry = flatRows.find(
			(candidate): candidate is PositionedRow & { row: VirtualLine } =>
				candidate.row.kind === 'line' && candidate.row.lineIndex === lineIdx
		);
		if (!entry) return;
		scrollToOffset(Math.max(0, entry.offset - viewportHeight / 3));
		await tick();
		const input = document.querySelector<HTMLInputElement>(`[data-line-idx="${lineIdx}"]`);
		if (input) {
			input.focus();
			input.select?.();
		}
	}

	async function jumpNextPending(fromLineIdx: number): Promise<void> {
		let searchIdx = fromLineIdx + 1;
		while (searchIdx < lineCount) {
			const entry = flatRows.find(
				(candidate): candidate is PositionedRow & { row: VirtualLine } =>
					candidate.row.kind === 'line' && candidate.row.lineIndex === searchIdx
			);
			if (entry && entry.row.line.countedStock == null) {
				await focusLineAtIndex(searchIdx);
				return;
			}
			searchIdx += 1;
		}
	}

	function handleRowKeydown(event: KeyboardEvent, line: CountLineRow, lineIndex: number): void {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			saveLine(line, input.value);
			void jumpNextPending(lineIndex);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			void focusLineAtIndex(Math.min(lineIndex + 1, lineCount - 1));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			void focusLineAtIndex(Math.max(0, lineIndex - 1));
		} else if (event.key === 'Escape') {
			event.preventDefault();
			input.value = String(finalCount(line) ?? '');
			input.blur();
		}
	}

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
		const nextPos = fichaOrder.findIndex(
			(id, index) => index > currentPos && lines.find((l) => l.id === id)?.countedStock == null
		);
		if (nextPos >= 0) fichaIndex = nextPos;
		else if (currentPos < fichaOrder.length - 1) fichaIndex = currentPos + 1;
	}

	function goToPrevFicha(): void {
		fichaIndex = Math.max(0, fichaIndex - 1);
	}

	function saveLine(line: CountLineRow, raw: string): void {
		if (raw === '') return;
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
				{
					value: 'ZERO_STOCK',
					label: 'Stock 0',
					tooltip: 'Ítems con stock 0 en el sistema|Confírmalos en lote; no bloquean el cierre.'
				}
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
		<span class="text-xs text-on-surface-variant">
			{pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
		</span>
		{#if !isMobile}
			<TriggerTooltip
				title="Atajos de teclado"
				text="↑ ↓ mover · Enter guardar y pasar al siguiente · Esc deshacer · / buscar"
			>
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
				<p class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					{fichaLine.brandName} · ficha {Math.min(fichaIndex + 1, fichaOrder.length)} de
					{fichaOrder.length}
				</p>
				<p class="font-heading mt-1 text-2xl font-bold text-brand-navy">{fichaLine.itemName}</p>
				<p class="font-mono text-xs text-outline">{fichaLine.itemCode ?? ''}</p>
				<p class="mt-6 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					Sistema
				</p>
				<p class="font-heading text-[56px] leading-none font-bold text-brand-navy">
					{fichaLine.systemStock}
				</p>
				<p class="mt-4 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					Contado
				</p>
				<input
					type="text"
					inputmode="numeric"
					enterkeyhint="next"
					aria-label="Contado {fichaLine.itemName}"
					value={finalCount(fichaLine) ?? ''}
					disabled={!canCount}
					class="mx-auto mt-1 block w-40 rounded-xl border border-outline-variant/40 bg-white px-3 py-3 text-center text-4xl font-bold"
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
		<div class="relative flex-1">
			{#if overlayGroup}
				<div
					class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-surface-container-low px-3 py-1 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase"
				>
					<span>{overlayGroup.name} · {overlayGroup.counted}/{overlayGroup.total}</span>
				</div>
			{/if}

			<div
				bind:this={viewport}
				onscroll={handleScroll}
				class="max-h-[520px] overflow-auto"
				onchange={() => {}}
			>
				{#if flatRows.length === 0}
					<div class="px-6 py-10 text-center text-sm text-on-surface-variant">
						<b class="text-brand-navy">Sin resultados</b>
						<span class="block">Prueba otra búsqueda o cambia el filtro</span>
					</div>
				{:else}
					<div style={`height:${totalHeight}px;position:relative`}>
						{#each visibleRows as entry (rowKey(entry))}
							<div
								style={`position:absolute;top:${entry.offset}px;left:0;right:0;height:${entry.height}px`}
							>
								{#if entry.row.kind === 'group'}
									<div
										class="flex items-center justify-between border-y border-outline-variant/30 bg-surface-container-low px-3 py-1 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase"
									>
										<span>
											{entry.row.name === 'Stock 0'
												? `${zeroOpen ? '▾' : '▸'} Stock 0 · ${entry.row.total} ítems`
												: `${entry.row.name} · ${entry.row.counted}/${entry.row.total}`}
										</span>
										{#if entry.row.isZero}
											<button
												type="button"
												class="pointer-events-auto rounded bg-brand-navy px-2 py-0.5 text-xs text-white"
												disabled={zeroStock.pending === 0}
												onclick={onConfirmZero}
											>
												Confirmar los {zeroStock.pending} en 0
											</button>
										{/if}
									</div>
								{:else}
									{@const virtualLine = entry.row as VirtualLine}
									{@const line = virtualLine.line}
									{@const diff = lineDiff(line)}
									<div
										class="grid h-full grid-cols-[26px_1fr_70px_110px_110px] items-center gap-2.5 border-t border-outline-variant/40 px-3 transition-colors focus-within:bg-info-container"
									>
										<StatusIcon
											{line}
											diffThresholdUnits={config.diffThresholdUnits}
											diffThresholdUsd={config.diffThresholdUsd}
											unitCost={costByLineId.get(line.id) ?? null}
										/>
										<span class="flex min-w-0 flex-col justify-center">
											<span class="truncate text-sm font-medium text-brand-navy"
												>{line.itemName}</span
											>
											{#if line.notes}
												<span class="truncate text-xs text-on-surface-variant">{line.notes}</span>
											{:else}
												<span class="truncate font-mono text-xs text-outline"
													>{line.itemCode ?? ''}</span
												>
											{/if}
										</span>
										<span class="text-right text-brand-navy tabular-nums">{line.systemStock}</span>
										<input
											type="text"
											inputmode="numeric"
											aria-label="Contado {line.itemName}"
											value={finalCount(line) ?? ''}
											disabled={!canCount}
											data-line-idx={entry.row.lineIndex}
											class="w-24 rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-right font-semibold tabular-nums focus:ring-2 focus:ring-brand-blue/50 focus:outline-none"
											oninput={(event) => {
												const input = event.currentTarget as HTMLInputElement;
												input.value = input.value.replace(/\D/g, '').slice(0, 4);
											}}
											onchange={(event) =>
												saveLine(line, (event.currentTarget as HTMLInputElement).value)}
											onkeydown={(event) => handleRowKeydown(event, line, virtualLine.lineIndex)}
										/>
										<div class="text-right">
											{#if line.countedStock != null && diff !== 0}
												<DiffBadge
													{diff}
													gravity={gravityOf(line)}
													systemStock={line.systemStock}
													counted={finalCount(line)}
													stateTitle={gravityOf(line) === 'high'
														? diff! > 0
															? `Sobran ${diff}`
															: `Falta ${Math.abs(diff!)}`
														: 'Diferencia baja'}
													textual
												/>
											{:else}
												<span>—</span>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
