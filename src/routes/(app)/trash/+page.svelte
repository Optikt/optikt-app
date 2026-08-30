<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { RotateCcw, Trash2 } from '@lucide/svelte';
	import { restoreItemCmd } from '$lib/remote/trash.remote';
	import { getErrorMessage } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let loadingId = $state<string | null>(null);

	const entityLabels: Record<string, string> = {
		user: 'Usuario',
		product: 'Producto',
		brand: 'Marca',
		customer: 'Cliente',
		prescription: 'Prescripción',
		supplier: 'Proveedor',
		material: 'Material',
		lens_material: 'Material de lente',
		lens_technology: 'Tecnología',
		lens_catalog_item: 'Lente',
		supplier_treatment: 'Tratamiento'
	};

	async function restoreItem(entityType: string, entityId: string) {
		loadingId = entityId;
		try {
			await restoreItemCmd({ entityType, entityId });
			toast.success('Elemento restaurado');
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error restaurando'));
		} finally {
			loadingId = null;
		}
	}

</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-heading text-3xl font-extrabold tracking-[-0.04em] text-brand-navy">
				Papelera
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				Registros eliminados. Restaurá los que necesites; nunca se borran permanentemente.
			</p>
		</div>
	</div>

	{#if data.items.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center"
		>
			<Trash2 class="h-10 w-10 text-slate-300" />
			<p class="mt-3 text-sm text-slate-500">La papelera está vacía.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-xl border border-slate-200">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3">Tipo</th>
						<th class="px-4 py-3">Nombre</th>
						<th class="px-4 py-3">Eliminado</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.items as item (item.id)}
						<tr class="hover:bg-slate-50/60">
							<td class="px-4 py-3">
								<span
									class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
								>
									{entityLabels[item.entityType] ?? item.entityType}
								</span>
							</td>
							<td class="px-4 py-3 text-slate-900">{item.label}</td>
							<td class="px-4 py-3 text-slate-500">{new Date(item.deletedAt).toLocaleString()}</td>
							<td class="px-4 py-3 text-right">
								<button
									class="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
									onclick={() => restoreItem(item.entityType, item.entityId)}
									disabled={loadingId === item.entityId}
									aria-label={`Restaurar ${item.label}`}
								>
									<RotateCcw class="h-3.5 w-3.5" />
									{loadingId === item.entityId ? 'Restaurando…' : 'Restaurar'}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
