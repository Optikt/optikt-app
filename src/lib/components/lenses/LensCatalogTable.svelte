<script lang="ts">
	import { Button, Badge, Spinner } from 'flowbite-svelte';
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage, formatPrice } from '$lib/utils';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import {
		LensType,
		LensCatalogSource,
		LENS_TYPE_LABELS,
		LENS_SOURCE_LABELS
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { resolve } from '$app/paths';

	type Props = {
		items: LensCatalogItemWithRelations[];
		loading: boolean;
		onRefresh: () => void;
	};

	let { items, loading, onRefresh }: Props = $props();

	function formatRange(min: number | null, max: number | null): string {
		if (min === null && max === null) return '—';
		const fmtNum = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
		if (min !== null && max !== null) return `${fmtNum(min)} a ${fmtNum(max)}`;
		if (min !== null) return `desde ${fmtNum(min)}`;
		return `hasta ${fmtNum(max!)}`;
	}

	function formatRangeSummary(item: LensCatalogItemWithRelations): string {
		if (!item.ranges || item.ranges.length === 0) return '—';
		const first = item.ranges[0];
		const summary = formatRange(first.sphereMin, first.sphereMax);
		if (item.ranges.length > 1) {
			return `${summary} (+${item.ranges.length - 1})`;
		}
		return summary;
	}

	function getLensTypeBadgeColor(type: string): 'blue' | 'green' | 'purple' | 'yellow' {
		switch (type) {
			case LensType.MONOFOCAL:
				return 'blue';
			case LensType.BIFOCAL:
				return 'green';
			case LensType.PROGRESSIVE:
				return 'purple';
			case LensType.OCCUPATIONAL:
				return 'yellow';
			default:
				return 'blue';
		}
	}

	async function handleDelete(item: LensCatalogItemWithRelations) {
		if (!confirm(`¿Eliminar "${item.name}" del catálogo?`)) return;
		try {
			await deleteLensCatalogItemById({ id: item.id });
			toast.success('Item eliminado del catálogo');
			onRefresh();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando item'));
		}
	}
</script>

<div class="overflow-x-auto rounded-lg border border-slate-200">
	<table class="w-full text-left text-sm">
		<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
			<tr>
				<th class="px-4 py-3">Nombre</th>
				<th class="px-4 py-3">Origen</th>
				<th class="px-4 py-3">Proveedor</th>
				<th class="px-4 py-3">Tipo</th>
				<th class="px-4 py-3">Material</th>
				<th class="px-4 py-3">Tecnología</th>
				<th class="px-4 py-3">Rangos</th>
				<th class="px-4 py-3 text-right">Precio Base</th>
				<th class="px-4 py-3 text-right">Acciones</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100">
			{#if loading}
				<tr>
					<td colspan="9" class="px-4 py-8 text-center">
						<Spinner size="6" />
					</td>
				</tr>
			{:else if items.length === 0}
				<tr>
					<td colspan="9" class="px-4 py-8 text-center text-sm text-slate-400">
						No hay lentes en el catálogo
					</td>
				</tr>
			{:else}
				{#each items as item (item.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<div>
								<p class="font-medium text-slate-800">{item.name}</p>
								{#if item.brand}
									<p class="text-xs text-slate-500">{item.brand}</p>
								{/if}
							</div>
						</td>
						<td class="px-4 py-3">
							<Badge
								color={item.source === LensCatalogSource.FINISHED ? 'indigo' : 'gray'}
								class="text-xs"
							>
								{LENS_SOURCE_LABELS[item.source] ?? item.source}
							</Badge>
							{#if item.source === LensCatalogSource.FINISHED && item.stock !== null}
								<span class="ml-1 font-mono text-xs text-slate-500">
									({item.stock} uds)
								</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-slate-600">
							{item.supplier?.name ?? '—'}
						</td>
						<td class="px-4 py-3">
							<Badge color={getLensTypeBadgeColor(item.type)} class="text-xs">
								{LENS_TYPE_LABELS[item.type as LensType] ?? item.type}
							</Badge>
							{#if item.isPhotochromic}
								<Badge color="yellow" class="ml-1 text-xs">Foto</Badge>
							{/if}
						</td>
						<td class="px-4 py-3">
							{#if item.material}
								<span class="text-slate-700">{item.material.name}</span>
								{#if item.refractiveIndex}
									<span class="ml-1 font-mono text-xs text-slate-400">
										({item.refractiveIndex})
									</span>
								{/if}
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-slate-600">
							{item.technology ?? '—'}
						</td>
						<td class="px-4 py-3 font-mono text-sm">
							{formatRangeSummary(item)}
						</td>
						<td class="px-4 py-3 text-right font-mono font-medium text-slate-800">
							{formatPrice(item.basePrice)}
						</td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-1">
								<Button size="xs" color="alternative" href={resolve(`/lenses/${item.id}/edit`)}>
									<Pencil class="h-3.5 w-3.5" />
								</Button>
								<Button size="xs" color="red" outline onclick={() => handleDelete(item)}>
									<Trash2 class="h-3.5 w-3.5" />
								</Button>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
