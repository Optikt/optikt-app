<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { LensCatalogSource, LensInventoryMode } from '$lib/shared/enums';
	import {
		fieldLabelClass,
		formCardClass,
		sectionTitleClass,
		selectionCardClass
	} from './lensFormClasses';
	import type { LensCatalogFormData } from './lensFormTypes';

	interface Props {
		formData: LensCatalogFormData;
	}

	let { formData = $bindable() }: Props = $props();
</script>

<section class={formCardClass}>
	<div class="flex items-center gap-2">
		<span class="h-2 w-2 rounded-full bg-brand-blue"></span>
		<h3 class={sectionTitleClass}>Gestion</h3>
	</div>

	<div class="mt-6 space-y-6">
		<div>
			<p class={fieldLabelClass}>Modalidad de inventario</p>
			{#if formData.source === LensCatalogSource.FINISHED}
				<input type="hidden" name="inventoryMode" value={formData.inventoryMode} />
				<div class="mt-3 grid gap-3 sm:grid-cols-2">
					<button
						type="button"
						aria-pressed={formData.inventoryMode === LensInventoryMode.STOCK}
						class="{selectionCardClass} {formData.inventoryMode === LensInventoryMode.STOCK
							? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
							: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
						onclick={() => (formData.inventoryMode = LensInventoryMode.STOCK)}
					>
						<div>
							<p
								class="text-sm font-semibold {formData.inventoryMode ===
								LensInventoryMode.STOCK
									? 'text-white'
									: 'text-on-surface'}"
							>
								Stock
							</p>
							<p
								class="mt-1 text-xs leading-5 {formData.inventoryMode ===
								LensInventoryMode.STOCK
									? 'text-white/75'
									: 'text-on-surface-variant'}"
							>
								Se descuenta del inventario disponible.
							</p>
						</div>
					</button>
					<button
						type="button"
						aria-pressed={formData.inventoryMode === LensInventoryMode.ON_DEMAND}
						class="{selectionCardClass} {formData.inventoryMode ===
						LensInventoryMode.ON_DEMAND
							? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
							: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
						onclick={() => (formData.inventoryMode = LensInventoryMode.ON_DEMAND)}
					>
						<div>
							<p
								class="text-sm font-semibold {formData.inventoryMode ===
								LensInventoryMode.ON_DEMAND
									? 'text-white'
									: 'text-on-surface'}"
							>
								Bajo pedido
							</p>
							<p
								class="mt-1 text-xs leading-5 {formData.inventoryMode ===
								LensInventoryMode.ON_DEMAND
									? 'text-white/75'
									: 'text-on-surface-variant'}"
							>
								Se compra al proveedor cuando se confirma la venta.
							</p>
						</div>
					</button>
				</div>

				{#if formData.inventoryMode === LensInventoryMode.STOCK}
					<div class="mt-4">
						<Label for="lc_stock" class={fieldLabelClass}>Cantidad en stock</Label>
						<input
							id="lc_stock"
							name="stock"
							bind:value={formData.stock}
							type="number"
							min="0"
							class="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
						/>
					</div>
				{/if}
			{:else}
				<input type="hidden" name="inventoryMode" value={LensInventoryMode.ON_DEMAND} />
				<div
					class="mt-3 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-4 text-sm text-on-surface-variant"
				>
					Los lentes de laboratorio se gestionan siempre bajo pedido.
				</div>
			{/if}
		</div>

		<div class="rounded-xl bg-surface-container-low px-4 py-4">
			<p class={fieldLabelClass}>Notas internas</p>
			<textarea
				id="lc_notes"
				name="notes"
				bind:value={formData.notes}
				rows={3}
				placeholder="Acuerdos con proveedor, restricciones o notas operativas..."
				class="mt-3 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
			></textarea>
		</div>
	</div>
</section>
