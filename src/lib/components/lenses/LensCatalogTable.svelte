<script lang="ts">
	import { Button, Badge, Spinner, Popover } from 'flowbite-svelte';
	import { Pencil, Trash2, Eye, Layers } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage, formatPrice } from '$lib/utils';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import {
		LensType,
		LensCatalogSource,
		LENS_TYPE_LABELS,
		LENS_SOURCE_LABELS
	} from '$lib/shared/enums';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { resolve } from '$app/paths';

	type Props = {
		items: LensCatalogItemWithRelations[];
		loading: boolean;
		onRefresh: () => void;
	};

	let { items, loading, onRefresh }: Props = $props();

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
				<th class="px-4 py-3 text-right">Precio Venta</th>
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
					{@const displayRanges = collapseRangesForDisplay(item.ranges ?? [])}
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
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-slate-600">
							{item.technology ?? '—'}
						</td>
						<td class="px-4 py-3">
							{#if displayRanges.length > 0}
								<button
									id="ranges-{item.id}"
									class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
								>
									<Layers class="h-3 w-3" />
									{displayRanges.length}
									{displayRanges.length === 1 ? 'rango' : 'rangos'}
								</button>
								<Popover triggeredBy="#ranges-{item.id}" class="w-72 text-sm" trigger="hover">
									<div class="space-y-2">
										{#each displayRanges as dr, i (dr.id)}
											<div class="rounded-md bg-slate-50 p-2">
												{#if displayRanges.length > 1}
													<p class="mb-1 text-xs font-semibold text-slate-500">
														Rango {i + 1}
														{#if dr.symmetric}
															<span class="ml-1 text-indigo-500">(±)</span>
														{/if}
													</p>
												{/if}
												<div class="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
													<span class="text-slate-500">Esfera:</span>
													<span class="text-slate-800">{dr.sphereLabel}</span>
													{#if dr.cylinderLabel}
														<span class="text-slate-500">Cilindro:</span>
														<span class="text-slate-800">{dr.cylinderLabel}</span>
													{/if}
													{#if dr.additionLabel}
														<span class="text-slate-500">Adición:</span>
														<span class="text-slate-800">{dr.additionLabel}</span>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</Popover>
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right font-mono font-medium text-slate-800">
							{#if item.salePrice != null}
								{formatPrice(item.salePrice)}
							{:else}
								<span class="text-xs text-slate-400 italic">Sin precio</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-1">
								<Button size="xs" color="alternative" href={resolve(`/lenses/${item.id}`)}>
									<Eye class="h-3.5 w-3.5" />
								</Button>
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
