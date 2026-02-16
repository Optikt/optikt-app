<script lang="ts" generics="T extends { id: string }">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Spinner
	} from 'flowbite-svelte';
	import type { Snippet, Component } from 'svelte';

	interface Props {
		items: T[];
		loading?: boolean;
		emptyIcon?: Component<{ class?: string }>;
		emptyTitle?: string;
		emptyDescription?: string;
		header: Snippet;
		row: Snippet<[T]>;
		actions?: Snippet<[T]>;
		rowClass?: string;
	}

	let {
		items,
		loading = false,
		emptyIcon: EmptyIcon,
		emptyTitle = 'No se encontraron resultados',
		emptyDescription,
		header,
		row,
		actions,
		rowClass = 'hover:bg-slate-50'
	}: Props = $props();
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Spinner size="10" />
	</div>
{:else if items.length > 0}
	<Table hoverable>
		<TableHead class="bg-slate-50">
			{@render header()}
			{#if actions}
				<TableHeadCell class="text-right font-semibold">Acciones</TableHeadCell>
			{/if}
		</TableHead>
		<TableBody>
			{#each items as item (item.id)}
				<TableBodyRow class={rowClass}>
					{@render row(item)}
					{#if actions}
						<TableBodyCell class="text-right">
							<div class="flex justify-end gap-1">
								{@render actions(item)}
							</div>
						</TableBodyCell>
					{/if}
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
{:else}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center"
	>
		{#if EmptyIcon}
			<EmptyIcon class="mb-3 h-10 w-10 text-slate-400" />
		{/if}
		<p class="text-sm font-medium text-slate-600">{emptyTitle}</p>
		{#if emptyDescription}
			<p class="mt-1 text-xs text-slate-400">{emptyDescription}</p>
		{/if}
	</div>
{/if}
