<script lang="ts">
	import { resolve } from '$app/paths';
	import { Package, Eye } from '@lucide/svelte';
	import type { LowStockItem } from '$lib/server/db/queries/dashboard';

	let { items }: { items: LowStockItem[] } = $props();
</script>

{#if items.length === 0}
	<p class="py-8 text-center text-sm text-slate-400">Todo el inventario está en orden</p>
{:else}
	<div class="divide-y divide-slate-100">
		{#each items as item (item.id)}
			<a
				href={resolve(item.type === 'product' ? `/products/${item.id}` : `/lenses/${item.id}`)}
				class="flex items-center gap-3 px-1 py-3 no-underline transition-colors hover:bg-slate-50"
			>
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {item.type ===
					'product'
						? 'bg-violet-50 text-violet-500'
						: 'bg-sky-50 text-sky-500'}"
				>
					{#if item.type === 'product'}
						<Package size={16} />
					{:else}
						<Eye size={16} />
					{/if}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm text-slate-700">{item.name}</p>
					{#if item.sku}
						<p class="font-mono text-xs text-slate-400">{item.sku}</p>
					{/if}
				</div>
				<div class="text-right">
					<span
						class="font-mono text-sm font-semibold {item.stock <= 0
							? 'text-red-600'
							: 'text-amber-600'}"
					>
						{item.stock}
					</span>
					{#if item.minStock != null}
						<p class="text-xs text-slate-400">mín: {item.minStock}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>
{/if}
