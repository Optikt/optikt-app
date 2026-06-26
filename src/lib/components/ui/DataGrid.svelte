<script lang="ts" generics="T extends { id: string | number }">
	import type { Snippet } from 'svelte';

	interface Column {
		key: string;
		label: string;
		align?: 'left' | 'right';
		hiddenClass?: string;
	}

	interface Props {
		columns: Column[];
		items: T[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		itemLabel?: string;
		emptyIcon?: Snippet;
		emptyTitle?: string;
		emptySubtitle?: string;
		row: Snippet<[T]>;
		mobileCard?: Snippet<[T]>;
		onPageChange: (page: number) => void;
	}

	let {
		columns,
		items,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		itemLabel = 'registros',
		emptyIcon,
		emptyTitle = 'Sin resultados',
		emptySubtitle = 'No se encontraron registros',
		row,
		mobileCard,
		onPageChange
	}: Props = $props();

	let showing = $derived(Math.min(items.length, perPage));

	function goToPage(p: number) {
		if (p >= 1 && p <= totalPages) {
			onPageChange(p);
		}
	}

	function getVisiblePages(current: number, tp: number): number[] {
		if (tp <= 5) return Array.from({ length: tp }, (_, i) => i + 1);
		if (current <= 3) return [1, 2, 3, 4, 5];
		if (current >= tp - 2) return [tp - 4, tp - 3, tp - 2, tp - 1, tp];
		return [current - 2, current - 1, current, current + 1, current + 2];
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue/30 border-t-brand-blue"
		></div>
	</div>
{:else if items.length > 0}
	{#if mobileCard}
		<div class="space-y-3 lg:hidden">
			{#each items as item (item.id)}
				<article
					class="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sm"
				>
					{@render mobileCard(item)}
				</article>
			{/each}
		</div>
	{/if}

	<div class={mobileCard ? 'hidden lg:block' : 'block'}>
		<div
			class="relative overflow-visible rounded-xl border border-outline-variant/30 bg-surface-container-lowest"
		>
			<table class="w-full">
				<thead>
					<tr class="border-b border-outline-variant bg-surface-container-high">
						{#each columns as col (col.key)}
							<th
								class="px-3 py-2.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase {col.align ===
								'right'
									? 'text-right'
									: 'text-left'} {col.hiddenClass ?? ''}"
							>
								{col.label}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-outline-variant/20">
					{#each items as item (item.id)}
						{@render row(item)}
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Count + Pagination -->
	<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
		<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
			Mostrando {showing} de {total}
			{itemLabel}
		</p>

		<nav class="flex items-center gap-1">
			<button
				onclick={() => goToPage(page - 1)}
				disabled={page <= 1}
				class="rounded-lg px-2.5 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"
			>
				‹
			</button>

			{#each getVisiblePages(page, totalPages) as pg (pg)}
				<button
					onclick={() => goToPage(pg)}
					class="min-w-[2rem] rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors {pg ===
					page
						? 'bg-brand-blue text-white'
						: 'text-on-surface-variant hover:bg-surface-container-high'}"
				>
					{pg}
				</button>
			{/each}

			<button
				onclick={() => goToPage(page + 1)}
				disabled={page >= totalPages}
				class="rounded-lg px-2.5 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"
			>
				›
			</button>
		</nav>
	</div>
{:else}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-12 text-center"
	>
		{#if emptyIcon}
			{@render emptyIcon()}
		{/if}
		<p class="font-medium text-on-surface-variant">{emptyTitle}</p>
		<p class="mt-1 text-sm text-outline">{emptySubtitle}</p>
	</div>
{/if}
