<script lang="ts">
	import { Copy } from '@lucide/svelte';
	import { Disclosure } from '$lib/components/ui';
	import { getLensTypeLabel, ALL_LENS_TYPES } from '$lib/shared/enums/lensTypes';
	import type { PrescriptionFieldErrors } from '../saleItemHelpers';

	interface Props {
		pair: import('../newSaleTypes').LensPairEntry;
		rxErrs: PrescriptionFieldErrors;
		open: boolean;
		itemId: string;
		hasRxValues: boolean;
		oncopyoi?: () => void;
	}

	let {
		pair = $bindable(),
		rxErrs = {} as PrescriptionFieldErrors,
		open = $bindable(),
		itemId,
		hasRxValues = false,
		oncopyoi
	}: Props = $props();

	const { od, oi } = $derived(pair);
	const id = $derived(itemId);
</script>

<Disclosure
	title="Fórmula"
	bind:open
	icon={Copy}
	statusBadge={Object.keys(rxErrs).length > 0 ? 'Pendiente' : hasRxValues ? 'Completa' : undefined}
	statusVariant={Object.keys(rxErrs).length > 0 ? 'error' : 'success'}
>
	<div class="mb-3 flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-1.5">
			<label for="rx-{id}-doctor" class="text-[10px] font-semibold text-outline uppercase"
				>Médico</label
			>
			<input
				id="rx-{id}-doctor"
				type="text"
				bind:value={pair.doctorName}
				placeholder="Nombre del doctor"
				class="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.doctorName
					? '!border-red-400'
					: ''}"
			/>
			{#if rxErrs.doctorName}<p class="text-[10px] text-red-500">{rxErrs.doctorName}</p>{/if}
		</div>
		<div class="flex items-center gap-1.5">
			<label for="rx-{id}-lens-type" class="text-[10px] font-semibold text-outline uppercase"
				>Tipo</label
			>
			<select
				id="rx-{id}-lens-type"
				bind:value={pair.lensType}
				class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
			>
				{#each ALL_LENS_TYPES as type (type)}
					<option value={type}>{getLensTypeLabel(type)}</option>
				{/each}
			</select>
		</div>
		<button
			type="button"
			onclick={oncopyoi}
			class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
		>
			<Copy class="h-3 w-3" />
			Copiar OI → OD
		</button>
	</div>

	<div class="grid grid-cols-[3.5rem_repeat(6,1fr)] gap-x-1.5 gap-y-1">
		<div class="text-center text-[10px] font-semibold text-outline uppercase"></div>
		<div class="text-center text-[10px] font-semibold text-outline uppercase">ESF</div>
		<div class="text-center text-[10px] font-semibold text-outline uppercase">CIL</div>
		<div class="text-center text-[10px] font-semibold text-outline uppercase">EJE</div>
		<div class="text-center text-[10px] font-semibold text-outline uppercase">ADD</div>
		<div class="text-center text-[10px] font-semibold text-outline uppercase">DP</div>
		<div class="text-center text-[10px] font-semibold text-outline uppercase">DNP</div>

		<div
			class="flex items-center rounded-lg bg-rose-50/30 px-2 py-1.5 text-xs font-semibold text-rose-700"
		>
			OI
		</div>
		<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
			<input
				id="rx-{id}-oi-sphere"
				type="number"
				step="0.25"
				placeholder="-2.00"
				bind:value={oi.prescription.sphere}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.oiSphere
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.oiSphere}<p class="text-[10px] text-red-500">{rxErrs.oiSphere}</p>{/if}
		</div>
		<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
			<input
				id="rx-{id}-oi-cylinder"
				type="number"
				step="0.25"
				min={-10}
				max={0}
				placeholder="-0.50"
				bind:value={oi.prescription.cylinder}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.oiCylinder
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.oiCylinder}<p class="text-[10px] text-red-500">{rxErrs.oiCylinder}</p>{/if}
		</div>
		<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
			<input
				id="rx-{id}-oi-axis"
				type="number"
				step="1"
				min={0}
				max={180}
				placeholder="180"
				bind:value={oi.prescription.axis}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.oiAxis
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.oiAxis}<p class="text-[10px] text-red-500">{rxErrs.oiAxis}</p>{/if}
		</div>
		<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
			<input
				id="rx-{id}-oi-addition"
				type="number"
				step="0.25"
				min={0}
				max={5}
				placeholder="+1.50"
				bind:value={oi.prescription.addition}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.oiAddition
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.oiAddition}<p class="text-[10px] text-red-500">{rxErrs.oiAddition}</p>{/if}
		</div>
		<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
			<input
				id="rx-{id}-oi-dp"
				type="number"
				step="1"
				min={10}
				max={80}
				placeholder="62"
				bind:value={oi.dp}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.oiDp
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.oiDp}<p class="text-[10px] text-red-500">{rxErrs.oiDp}</p>{/if}
		</div>
		<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
			<input
				id="rx-{id}-oi-np"
				type="number"
				step="1"
				min={10}
				max={80}
				placeholder="30"
				bind:value={oi.np}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.oiNp
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.oiNp}<p class="text-[10px] text-red-500">{rxErrs.oiNp}</p>{/if}
		</div>

		<div
			class="flex items-center rounded-lg bg-blue-50/30 px-2 py-1.5 text-xs font-semibold text-blue-700"
		>
			OD
		</div>
		<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
			<input
				id="rx-{id}-od-sphere"
				type="number"
				step="0.25"
				placeholder="-2.00"
				bind:value={od.prescription.sphere}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.odSphere
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.odSphere}<p class="text-[10px] text-red-500">{rxErrs.odSphere}</p>{/if}
		</div>
		<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
			<input
				id="rx-{id}-od-cylinder"
				type="number"
				step="0.25"
				min={-10}
				max={0}
				placeholder="-0.50"
				bind:value={od.prescription.cylinder}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.odCylinder
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.odCylinder}<p class="text-[10px] text-red-500">{rxErrs.odCylinder}</p>{/if}
		</div>
		<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
			<input
				id="rx-{id}-od-axis"
				type="number"
				step="1"
				min={0}
				max={180}
				placeholder="180"
				bind:value={od.prescription.axis}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.odAxis
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.odAxis}<p class="text-[10px] text-red-500">{rxErrs.odAxis}</p>{/if}
		</div>
		<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
			<input
				id="rx-{id}-od-addition"
				type="number"
				step="0.25"
				min={0}
				max={5}
				placeholder="+1.50"
				bind:value={od.prescription.addition}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.odAddition
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.odAddition}<p class="text-[10px] text-red-500">{rxErrs.odAddition}</p>{/if}
		</div>
		<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
			<input
				id="rx-{id}-od-dp"
				type="number"
				step="1"
				min={10}
				max={80}
				placeholder="62"
				bind:value={od.dp}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.odDp
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.odDp}<p class="text-[10px] text-red-500">{rxErrs.odDp}</p>{/if}
		</div>
		<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
			<input
				id="rx-{id}-od-np"
				type="number"
				step="1"
				min={10}
				max={80}
				placeholder="30"
				bind:value={od.np}
				class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {rxErrs.odNp
					? 'text-red-600'
					: ''}"
			/>{#if rxErrs.odNp}<p class="text-[10px] text-red-500">{rxErrs.odNp}</p>{/if}
		</div>
	</div>
</Disclosure>
