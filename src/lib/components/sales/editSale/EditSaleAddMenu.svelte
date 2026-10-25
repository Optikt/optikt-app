<script lang="ts">
	import { Check, ChevronDown, Plus, X } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { ADD_ITEM_KINDS, type AddItemKind } from './addItemKinds';

	interface Props {
		activeKind: AddItemKind | null;
		showClose?: boolean;
		onSelect: (kind: AddItemKind) => void;
		onClose: () => void;
	}

	let { activeKind, showClose = false, onSelect, onClose }: Props = $props();

	let menuOpen = $state(false);
	let activeOption = $derived(ADD_ITEM_KINDS.find((option) => option.kind === activeKind) ?? null);

	function select(kind: AddItemKind) {
		menuOpen = false;
		onSelect(kind);
	}
</script>

<div class="flex items-center gap-2">
	<Popover.Root bind:open={menuOpen}>
		<Popover.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue/50 hover:bg-slate-50 focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/20 focus-visible:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
				>
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md {activeOption
							? activeOption.tone
							: 'bg-brand-blue/10 text-brand-blue'}"
					>
						{#if activeOption}
							{@const Icon = activeOption.icon}
							<Icon class="h-3.5 w-3.5" />
						{:else}
							<Plus class="h-3.5 w-3.5" />
						{/if}
					</span>
					<span>{activeOption ? activeOption.actionLabel : 'Agregar artículo'}</span>
					<ChevronDown class="h-3.5 w-3.5 text-slate-400" />
				</button>
			{/snippet}
		</Popover.Trigger>

		<Popover.Content align="start" sideOffset={6} class="w-64 gap-0 p-1">
			<div role="menu" aria-label="Agregar artículo" class="flex flex-col">
				{#each ADD_ITEM_KINDS as option (option.kind)}
					{@const Icon = option.icon}
					<button
						type="button"
						role="menuitem"
						onclick={() => select(option.kind)}
						class="flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
					>
						<span
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md {option.tone}"
						>
							<Icon class="h-3.5 w-3.5" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-xs font-semibold text-brand-navy dark:text-white"
								>{option.label}</span
							>
							<span class="block text-[11px] text-slate-500 dark:text-slate-400">{option.hint}</span
							>
						</span>
						{#if activeKind === option.kind}
							<Check class="h-4 w-4 shrink-0 text-brand-blue" />
						{/if}
					</button>
				{/each}
			</div>
		</Popover.Content>
	</Popover.Root>

	{#if activeKind || showClose}
		{#snippet closeTrigger({ props }: { props: Record<string, unknown> })}
			<button
				{...props}
				type="button"
				onclick={onClose}
				aria-label="Cerrar formulario"
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-900/30"
			>
				<X class="h-4 w-4" />
			</button>
		{/snippet}
		<TriggerTooltip text="Cerrar formulario" trigger={closeTrigger} />
	{/if}
</div>
