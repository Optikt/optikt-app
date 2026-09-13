<script lang="ts">
	import { FreeItemCategory } from '$lib/shared/enums/lensTypes';

	interface SupplierOption {
		id: string;
		name: string;
	}

	interface Props {
		isReEnriching: boolean;
		confirming: boolean;
		unitCost: number | null;
		supplierId: string;
		opticalNotes: string;
		saving: boolean;
		category: string | null;
		suppliers: SupplierOption[];
		onBack: () => void;
		onCancel: () => void;
		onSave: () => void;
	}

	let {
		isReEnriching,
		confirming,
		unitCost = $bindable(),
		supplierId = $bindable(),
		opticalNotes = $bindable(),
		saving,
		category,
		suppliers,
		onBack,
		onCancel,
		onSave
	}: Props = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
	role="dialog"
	aria-modal="true"
>
	<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
		<h3 class="mb-4 text-lg font-semibold text-brand-navy">
			{isReEnriching ? 'Editar ítem libre' : 'Completar ítem libre'}
		</h3>

		{#if confirming}
			<div class="rounded-xl bg-warning-container/60 px-4 py-3 text-sm text-on-warning-container">
				<p class="font-semibold">⚠ Confirmar cambios</p>
				<p class="mt-1 text-xs">
					Este ítem ya fue completado. ¿Guardar los cambios y sobreescribir los datos anteriores?
				</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#if isReEnriching}
					<p
						class="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant"
					>
						Editando un ítem ya completado. Los cambios sobreescribirán los valores anteriores.
					</p>
				{/if}
				<div>
					<label
						for="enrich-unit-cost"
						class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
					>
						Costo real (USD) *
					</label>
					<input
						id="enrich-unit-cost"
						type="number"
						bind:value={unitCost}
						step="0.01"
						min="0.01"
						class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						placeholder="0.00"
					/>
				</div>

				{#if suppliers.length > 0}
					<div>
						<label
							for="enrich-supplier-id"
							class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
						>
							Proveedor
						</label>
						<select
							id="enrich-supplier-id"
							bind:value={supplierId}
							class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						>
							<option value="">Sin proveedor</option>
							{#each suppliers as supplier (supplier.id)}
								<option value={supplier.id}>{supplier.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div>
					<label
						for="enrich-optical-notes"
						class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
					>
						Notas ópticas
					</label>
					<input
						id="enrich-optical-notes"
						type="text"
						bind:value={opticalNotes}
						maxlength={1000}
						class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
						placeholder="OD -2.50 sph, color miel..."
					/>
				</div>
			</div>
		{/if}

		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={confirming ? onBack : onCancel}
				class="rounded-xl px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
			>
				{confirming ? 'Volver' : 'Cancelar'}
			</button>
			<button
				type="button"
				onclick={onSave}
				disabled={saving ||
					(!confirming &&
						(unitCost == null || (category !== FreeItemCategory.SERVICE && unitCost <= 0)))}
				class="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 {confirming
					? 'bg-error hover:bg-error/90'
					: 'bg-amber-600 hover:bg-amber-700'}"
			>
				{saving
					? 'Guardando...'
					: confirming
						? 'Confirmar cambios'
						: isReEnriching
							? 'Guardar cambios'
							: 'Guardar'}
			</button>
		</div>
	</div>
</div>
