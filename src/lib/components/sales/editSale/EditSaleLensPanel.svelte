<script lang="ts">
	import { slide } from 'svelte/transition';
	import { FlaskConical, Save, X } from '@lucide/svelte';
	import { DiscountType } from '$lib/shared/enums';
	import ItemSelect from '../ItemSelect.svelte';
	import { formatPrice } from '$lib/utils';
	import type { EditableItem } from '../editSaleDraft';
	import { LensType } from '$lib/shared/enums/lensTypes';

	interface Props {
		showAddLens: boolean;
		editingLensId: string | null;
		editLensTmp: EditableItem;
		editLensTreatments: {
			supplierTreatmentId: string;
			name: string;
			price: number;
			salePrice: number;
			isTaxable: boolean;
			category: string;
		}[];
		availableTreatments: { id: string; name: string; price: number; salePrice?: number; isTaxable: boolean; category: string }[];
		selectableTreatments: { id: string; name: string; price: number; salePrice?: number }[];
		selectedLens: { type?: string } | null;
		showAddition: boolean;
		onLensSelect: (id: string, unitPrice: number) => void;
		onAddTreatment: (id: string) => void;
		onRemoveTreatment: (idx: number) => void;
		onSave: () => void;
		onCancel: () => void;
	}

	let {
		showAddLens,
		editingLensId,
		editLensTmp = $bindable(),
		editLensTreatments = $bindable(),
		availableTreatments,
		selectableTreatments,
		selectedLens,
		showAddition,
		onLensSelect,
		onAddTreatment,
		onRemoveTreatment,
		onSave,
		onCancel
	}: Props = $props();
</script>

{#if showAddLens || editingLensId}
	<div
		transition:slide={{ duration: 180 }}
		class="mb-3 rounded-lg border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-slate-800"
	>
		<p class="mb-3 text-xs font-bold text-sky-800 dark:text-sky-300">
			{editingLensId ? 'Editar cristal' : 'Agregar cristal'}
		</p>
		<div class="space-y-3">
			<ItemSelect
				kind="lens"
				value={editLensTmp.lensCatalogItemId ?? ''}
				onselect={onLensSelect}
				label="Cristal"
			/>
			<div class="grid grid-cols-4 gap-3">
				<div>
					<label for="lens-quantity" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Cant.</label
					>
					<input id="lens-quantity" type="number" bind:value={editLensTmp.quantity} min="1" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
				</div>
				<div>
					<label for="lens-price" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Precio</label
					>
					<input id="lens-price" type="number" bind:value={editLensTmp.unitPrice} min="0" step="0.01" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
				</div>
				<div>
					<label for="lens-discount" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Desc.</label
					>
					<input id="lens-discount" type="number" bind:value={editLensTmp.discount} min="0" step="0.01" class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
				</div>
				<div>
					<label for="lens-discount-type" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Tipo desc.</label
					>
					<select id="lens-discount-type" bind:value={editLensTmp.discountType} class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white">
						<option value={DiscountType.FIXED}>$</option>
						<option value={DiscountType.PERCENTAGE}>%</option>
					</select>
				</div>
			</div>
			<div class="space-y-3">
				<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Receta Óptica</p>
				<div class="space-y-1">
					<span class="text-xs font-semibold text-slate-700 dark:text-slate-300">OD (Ojo Derecho)</span>
					<div class="grid gap-2" class:grid-cols-5={showAddition} class:grid-cols-3={!showAddition}>
						<span class="text-[10px] font-medium text-slate-500">Esf</span>
						<span class="text-[10px] font-medium text-slate-500">Cil</span>
						<span class="text-[10px] font-medium text-slate-500">Eje</span>
						{#if showAddition}
							<span class="text-[10px] font-medium text-slate-500">Add</span>
							<span class="text-[10px] font-medium text-slate-500">Alt</span>
						{/if}
					</div>
					<div class="grid gap-2" class:grid-cols-5={showAddition} class:grid-cols-3={!showAddition}>
						<input type="number" bind:value={editLensTmp.odSphere} step="0.25" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						<input type="number" bind:value={editLensTmp.odCylinder} step="0.25" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						<input type="number" bind:value={editLensTmp.odAxis} step="1" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						{#if showAddition}
							<input type="number" bind:value={editLensTmp.odAddition} step="0.25" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
							<input type="number" bind:value={editLensTmp.odAltura} step="1" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						{/if}
					</div>
				</div>
				<div class="space-y-1">
					<span class="text-xs font-semibold text-slate-700 dark:text-slate-300">OI (Ojo Izquierdo)</span>
					<div class="grid gap-2" class:grid-cols-5={showAddition} class:grid-cols-3={!showAddition}>
						<span class="text-[10px] font-medium text-slate-500">Esf</span>
						<span class="text-[10px] font-medium text-slate-500">Cil</span>
						<span class="text-[10px] font-medium text-slate-500">Eje</span>
						{#if showAddition}
							<span class="text-[10px] font-medium text-slate-500">Add</span>
							<span class="text-[10px] font-medium text-slate-500">Alt</span>
						{/if}
					</div>
					<div class="grid gap-2" class:grid-cols-5={showAddition} class:grid-cols-3={!showAddition}>
						<input type="number" bind:value={editLensTmp.osSphere} step="0.25" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						<input type="number" bind:value={editLensTmp.osCylinder} step="0.25" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						<input type="number" bind:value={editLensTmp.osAxis} step="1" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						{#if showAddition}
							<input type="number" bind:value={editLensTmp.osAddition} step="0.25" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
							<input type="number" bind:value={editLensTmp.osAltura} step="1" placeholder="—" class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
						{/if}
					</div>
				</div>
			</div>
			<div>
				<div class="mb-2 flex items-center justify-between">
					<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Tratamientos ({editLensTreatments.length})</p>
					<select value="" disabled={selectableTreatments.length === 0} onchange={(e: Event) => { const t = e.target as HTMLSelectElement; if (t.value) { onAddTreatment(t.value); t.value = ''; } }} class="w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
						<option value="" disabled>{selectableTreatments.length === 0 ? 'No hay más disponibles' : 'Agregar tratamiento...'}</option>
						{#each selectableTreatments as t (t.id)}
							<option value={t.id}>{t.name} — {formatPrice(t.salePrice ?? t.price)} / ojo</option>
						{/each}
					</select>
				</div>
				{#if editLensTreatments.length === 0}
					<p class="text-xs text-slate-400 italic">Sin tratamientos seleccionados</p>
				{:else}
					<div class="space-y-1">
						{#each editLensTreatments as t, idx (t.supplierTreatmentId + idx)}
							<div class="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-700">
								<FlaskConical class="h-3.5 w-3.5 shrink-0 text-purple-600" />
								<span class="flex-1 font-medium text-slate-800 dark:text-slate-200">{t.name}</span>
								<span class="font-mono text-slate-600 dark:text-slate-400">{formatPrice(t.salePrice * 2)}</span>
								<button type="button" onclick={() => onRemoveTreatment(idx)} class="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"><X class="h-3.5 w-3.5" /></button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<div class="flex justify-end gap-2 pt-1">
				<button type="button" onclick={onCancel} class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancelar</button>
				<button type="button" onclick={onSave} disabled={!editLensTmp.lensCatalogItemId || editLensTmp.unitPrice <= 0} class="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50"><Save class="h-3.5 w-3.5" />{editingLensId ? 'Guardar cambios' : 'Agregar cristal'}</button>
			</div>
		</div>
	</div>
{/if}
