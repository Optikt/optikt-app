<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import { groupDisplayLabel, remainingQty } from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';
	import {
		assignWhole,
		memberQty,
		newUiGroup,
		stepUnits,
		type GroupItemView,
		type UiGroup
	} from './groupsState';

	interface Props {
		item: GroupItemView;
		groups: UiGroup[];
		onchange: (groups: UiGroup[]) => void;
		onorganize?: () => void;
		/** Larger touch targets (mobile bottom sheet). */
		touch?: boolean;
	}

	let { item, groups, onchange, onorganize, touch = false }: Props = $props();

	let newName = $state('');

	const single = $derived(item.quantity <= 1);
	const free = $derived(remainingQty(item, groups));
	const btn = $derived(touch ? 'h-11 min-w-11' : 'h-8 min-w-8');

	function createPerson() {
		const group = newUiGroup(newName.trim() || null);
		const next = [...groups, group];
		const index = next.length - 1;
		onchange(single ? assignWhole(next, index, item) : stepUnits(next, index, item, 1));
		newName = '';
	}
</script>

<div class="flex flex-col gap-1.5">
	<p class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
		{single ? '¿Para quién es?' : `Reparto de ${item.quantity} unidades`}
	</p>

	{#if groups.length === 0}
		<p class="text-xs text-on-surface-variant">
			Aún no hay personas. Crea una abajo (el nombre es opcional).
		</p>
	{/if}

	{#each groups as group, index (group.key)}
		{@const n = memberQty(group, item.id)}
		<div
			class="flex min-h-[38px] items-center gap-2 rounded-lg px-1.5 py-0.5 {n > 0
				? 'bg-info-container/60'
				: ''}"
		>
			<PersonAvatar label={group.label} {index} />
			<span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-navy">
				{groupDisplayLabel(group.label, index)}
			</span>
			{#if single}
				<button
					type="button"
					aria-pressed={n > 0}
					onclick={() => onchange(assignWhole(groups, n > 0 ? null : index, item))}
					class="{btn} rounded-md border px-2.5 text-xs font-semibold transition-colors {n > 0
						? 'border-brand-navy bg-brand-navy text-white'
						: 'border-outline-variant bg-white text-brand-navy hover:bg-surface-container-low'}"
				>
					{n > 0 ? 'Asignado' : 'Asignar'}
				</button>
			{:else}
				<button
					type="button"
					aria-label="Quitar una unidad a {groupDisplayLabel(group.label, index)}"
					aria-disabled={n === 0}
					onclick={() => n > 0 && onchange(stepUnits(groups, index, item, -1))}
					class="{btn} inline-flex items-center justify-center rounded-md border border-outline-variant bg-white aria-disabled:opacity-40"
				>
					<Minus class="h-3.5 w-3.5" />
				</button>
				<span class="min-w-4 text-center font-mono font-bold">{n}</span>
				<button
					type="button"
					aria-label="Agregar una unidad a {groupDisplayLabel(group.label, index)}"
					aria-disabled={free === 0}
					onclick={() => free > 0 && onchange(stepUnits(groups, index, item, 1))}
					class="{btn} inline-flex items-center justify-center rounded-md border border-outline-variant bg-white aria-disabled:opacity-40"
				>
					<Plus class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	{/each}

	{#if !single}
		<p class="text-xs {free > 0 ? 'text-amber-700' : 'text-on-surface-variant'}">
			{free > 0 ? `${free} sin asignar` : 'Todas las unidades asignadas'}
		</p>
	{/if}

	<form
		class="flex gap-1.5 border-t border-outline-variant/50 pt-1.5"
		onsubmit={(e) => {
			e.preventDefault();
			createPerson();
		}}
	>
		<input
			aria-label="Nombre de la nueva persona"
			bind:value={newName}
			maxlength={60}
			placeholder="Nueva persona (opcional)"
			class="{touch
				? 'h-11'
				: 'h-8'} min-w-0 flex-1 rounded-md border border-outline-variant px-2 text-[13px]"
		/>
		<button
			type="submit"
			class="{touch
				? 'h-11'
				: 'h-8'} rounded-md bg-brand-navy px-2.5 text-xs font-semibold text-white"
		>
			+ Crear
		</button>
	</form>

	<div class="flex items-center justify-between">
		{#if single && groups.some((g) => memberQty(g, item.id) > 0)}
			<button
				type="button"
				onclick={() => onchange(assignWhole(groups, null, item))}
				class="py-1 text-xs text-on-surface-variant underline"
			>
				Quitar asignación
			</button>
		{/if}
		{#if onorganize}
			<button
				type="button"
				onclick={onorganize}
				class="ml-auto py-1 text-xs font-semibold text-brand-blue underline"
			>
				Organizar todo…
			</button>
		{/if}
	</div>
</div>
