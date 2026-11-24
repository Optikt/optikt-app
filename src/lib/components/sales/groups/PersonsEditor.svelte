<script lang="ts">
	import { Minus, Plus, Star, Trash2, TriangleAlert } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		groupCode,
		groupDisplayLabel,
		isGroupableItemType,
		remainingQty
	} from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';
	import {
		assignWhole,
		groupLensIds,
		groupUnits,
		memberQty,
		newUiGroup,
		removeGroup,
		renameGroup,
		stepUnits,
		type GroupItemView,
		type UiGroup
	} from './groupsState';

	interface Props {
		items: GroupItemView[];
		groups: UiGroup[];
		onchange: (groups: UiGroup[]) => void;
		/** Document label ("#0230", "P-0055") to render per-person codes ("230-1", "P-0055-1"). */
		docLabel?: string;
		/** Optional warning banner shown when editing an already-saved organization. */
		warningMessage?: string;
		/** Sales only: the ⭐ "Fórmula del cliente" toggle. */
		showPrimary?: boolean;
		primaryLensId?: string | null;
		onprimarychange?: (lensId: string | null) => void;
		touch?: boolean;
	}

	let {
		items,
		groups,
		onchange,
		docLabel,
		warningMessage,
		showPrimary = false,
		primaryLensId = null,
		onprimarychange,
		touch = false
	}: Props = $props();

	const rows = $derived(items.filter((i) => isGroupableItemType(i.itemType)));
	const lensCount = $derived(rows.filter((i) => i.itemType === 'LENS_PAIR').length);
	const cell = $derived(touch ? 'h-11 w-11' : 'h-[30px] w-[30px]');

	function togglePrimary(lensId: string) {
		onprimarychange?.(primaryLensId === lensId ? null : lensId);
	}
</script>

<div class="flex flex-col gap-3.5">
	{#if warningMessage}
		<div
			role="alert"
			class="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
		>
			<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
			<p class="leading-relaxed">{warningMessage}</p>
		</div>
	{/if}

	<section class="flex flex-col gap-1.5" aria-label="Personas">
		<p class="text-[11px] font-bold tracking-[0.1em] text-brand-navy">
			PERSONAS
			<span class="ml-1 rounded bg-brand-navy px-1.5 text-white">{groups.length}</span>
		</p>
		{#each groups as group, index (group.key)}
			{@const lenses = groupLensIds(group, items)}
			{@const isPrimary = lenses.length === 1 && lenses[0] === primaryLensId}
			{@const code = groupCode(docLabel, index)}
			<div
				class="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-2 sm:flex-nowrap"
			>
				<PersonAvatar label={group.label} {index} size="lg" />
				{#if code}
					<span
						class="shrink-0 rounded-md bg-brand-navy/10 px-2 py-1 font-mono text-[13px] font-bold text-brand-navy"
					>
						{code}
					</span>
				{/if}
				<input
					aria-label="Nombre de la persona {index + 1}"
					value={group.label ?? ''}
					oninput={(e) => onchange(renameGroup(groups, group.key, e.currentTarget.value))}
					maxlength={60}
					placeholder={`Trabajo ${index + 1} (nombre opcional)`}
					class="{touch
						? 'h-11'
						: 'h-9'} min-w-[100px] flex-1 rounded-md border border-outline-variant px-2.5 text-sm font-semibold text-brand-navy"
				/>
				<span class="shrink-0 text-xs font-medium whitespace-nowrap text-on-surface-variant">
					{groupUnits(group)}
					{groupUnits(group) === 1 ? 'ítem' : 'ítems'}
				</span>
				{#if showPrimary && lenses.length === 1}
					{#snippet primaryTrigger({ props }: { props: Record<string, unknown> })}
						<button
							{...props}
							type="button"
							aria-pressed={isPrimary}
							onclick={() => togglePrimary(lenses[0])}
							class="{touch
								? 'h-11'
								: 'h-8'} inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors {isPrimary
								? 'border-[#d4a900] bg-[#ffeb85] text-[#5c4700] shadow-xs'
								: 'border-outline-variant bg-white text-on-surface-variant hover:border-[#e6c200] hover:bg-[#fffbeb] hover:text-[#6f5900]'}"
						>
							<Star class="h-3.5 w-3.5 {isPrimary ? 'fill-current' : ''}" />
							Principal
						</button>
					{/snippet}
					<TriggerTooltip
						title={isPrimary ? 'Fórmula del cliente (activa)' : 'Fórmula del cliente'}
						text={isPrimary
							? 'Esta graduación se guardará como la fórmula vigente del cliente. Haz clic para desmarcar.'
							: 'Márcala para guardar esta graduación como la fórmula vigente del cliente.'}
						trigger={primaryTrigger}
					/>
				{/if}
				<button
					type="button"
					aria-label="Quitar {groupDisplayLabel(group.label, index)}"
					onclick={() => onchange(removeGroup(groups, group.key))}
					class="{cell} inline-flex shrink-0 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
		{/each}
		<button
			type="button"
			onclick={() => onchange([...groups, newUiGroup()])}
			class="{touch
				? 'h-11'
				: 'h-8'} self-start rounded-md border border-dashed border-outline px-2.5 text-xs font-semibold text-brand-navy"
		>
			+ Agregar persona
		</button>
	</section>

	{#if groups.length > 0}
		<section class="flex flex-col gap-1.5" aria-label="Reparto">
			<p class="text-[11px] font-bold tracking-[0.1em] text-brand-navy">REPARTO</p>
			<div class="overflow-x-auto rounded-lg bg-white">
				<table class="w-full border-collapse text-xs">
					<thead>
						<tr>
							<th class="p-2 text-left font-semibold text-on-surface-variant">Artículo</th>
							{#each groups as group, index (group.key)}
								{@const code = groupCode(docLabel, index)}
								<th class="px-1.5 py-2">
									<span class="sr-only">{groupDisplayLabel(group.label, index)}</span>
									<div class="flex flex-col items-center gap-1">
										<PersonAvatar label={group.label} {index} />
										{#if code}
											<span class="font-mono text-xs font-bold text-brand-navy">
												{code}
											</span>
										{/if}
									</div>
								</th>
							{/each}
							<th class="px-1 py-2 font-semibold text-on-surface-variant">Libre</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as item (item.id)}
							{@const free = remainingQty(item, groups)}
							<tr class="border-t border-surface-container-high">
								<td class="max-w-[200px] px-2 py-2 text-[13px]">
									<span class="font-semibold text-brand-navy">{item.name}</span>
									<span class="text-xs text-on-surface-variant">×{item.quantity}</span>
									{#if showPrimary && item.itemType === 'LENS_PAIR' && lensCount > 1}
										{@const isLensPrimary = primaryLensId === item.id}
										{#snippet lensStarTrigger({ props }: { props: Record<string, unknown> })}
											<button
												{...props}
												type="button"
												aria-pressed={isLensPrimary}
												aria-label="Fórmula del cliente: {item.name}"
												onclick={() => togglePrimary(item.id)}
												class="ml-1 inline-flex align-middle transition-colors {isLensPrimary
													? 'text-[#b38f00]'
													: 'text-outline hover:text-[#b38f00]'}"
											>
												<Star class="h-3.5 w-3.5 {isLensPrimary ? 'fill-current' : ''}" />
											</button>
										{/snippet}
										<TriggerTooltip
											title={isLensPrimary ? 'Fórmula del cliente (activa)' : 'Fórmula del cliente'}
											text={isLensPrimary
												? 'Se guardará como la fórmula vigente del cliente. Clic para desmarcar.'
												: 'Marcar este cristal como la fórmula vigente del cliente.'}
											trigger={lensStarTrigger}
										/>
									{/if}
								</td>
								{#each groups as group, index (group.key)}
									{@const n = memberQty(group, item.id)}
									{@const color = n > 0 ? 'border-brand-navy' : 'border-outline-variant'}
									<td class="p-1 text-center">
										{#if item.quantity <= 1}
											<button
												type="button"
												aria-pressed={n > 0}
												aria-label="{item.name} para {groupDisplayLabel(group.label, index)}"
												onclick={() => onchange(assignWhole(groups, n > 0 ? null : index, item))}
												class="{cell} rounded-full border-2 font-bold text-white {color} {n > 0
													? 'bg-brand-navy'
													: 'bg-white'}"
											>
												{n > 0 ? '✓' : ''}
											</button>
										{:else}
											<span class="inline-flex items-center rounded-md border-2 {color}">
												<button
													type="button"
													aria-label="Quitar una unidad"
													aria-disabled={n === 0}
													onclick={() => n > 0 && onchange(stepUnits(groups, index, item, -1))}
													class="{touch
														? 'h-11 w-9'
														: 'h-[26px] w-[22px]'} inline-flex items-center justify-center aria-disabled:opacity-30"
												>
													<Minus class="h-3 w-3" />
												</button>
												<span class="font-mono font-bold">{n}</span>
												<button
													type="button"
													aria-label="Agregar una unidad"
													aria-disabled={free === 0}
													onclick={() => free > 0 && onchange(stepUnits(groups, index, item, 1))}
													class="{touch
														? 'h-11 w-9'
														: 'h-[26px] w-[22px]'} inline-flex items-center justify-center aria-disabled:opacity-30"
												>
													<Plus class="h-3 w-3" />
												</button>
											</span>
										{/if}
									</td>
								{/each}
								<td
									class="p-1 text-center font-mono font-bold {free > 0
										? 'text-amber-700'
										: 'text-on-surface-variant'}"
								>
									{free}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-[11px] text-on-surface-variant">
				Los tratamientos siguen a su cristal. Una línea ×2 no se divide: solo se anota para quién es
				cada unidad.
			</p>
		</section>
	{/if}
</div>
