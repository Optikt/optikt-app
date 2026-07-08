<script lang="ts">
	import { Copy, X, Check } from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import { getLensTypeLabel, LensType } from '$lib/shared/enums/lensTypes';
	import type { LensPairEntry } from '../newSaleTypes';
	import { validateLensPair, type PrescriptionFieldErrors } from '../saleItemHelpers';

	interface Props {
		open: boolean;
		pair: LensPairEntry;
	}

	let { open = $bindable(), pair }: Props = $props();

	function clonePair(p: LensPairEntry): LensPairEntry {
		return {
			catalogItemId: p.catalogItemId,
			doctorName: p.doctorName,
			lensType: p.lensType,
			od: {
				enabled: p.od.enabled,
				dp: p.od.dp,
				np: p.od.np,
				prescription: { ...p.od.prescription }
			},
			oi: {
				enabled: p.oi.enabled,
				dp: p.oi.dp,
				np: p.oi.np,
				prescription: { ...p.oi.prescription }
			}
		};
	}

	let draft = $state<LensPairEntry>(clonePair(pair));

	$effect(() => {
		if (open) {
			draft = clonePair(pair);
		}
	});

	const draftRxErrs = $derived<PrescriptionFieldErrors>(validateLensPair(draft));

	const requiresAddition = $derived(draft.lensType !== LensType.MONOFOCAL);

	function handleCopyOiToOd() {
		draft.od.prescription = { ...draft.oi.prescription };
		draft.od.dp = draft.oi.dp;
		draft.od.np = draft.oi.np;
	}

	function handleApply() {
		pair.doctorName = draft.doctorName;
		pair.od = { ...draft.od };
		pair.oi = { ...draft.oi };
		open = false;
	}

	function handleCancel() {
		open = false;
	}
</script>

<SlideOver bind:open size="lg">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
			<p class="text-sm font-semibold text-brand-navy">Fórmula</p>
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-4">
		<!-- Header: Médico + Tipo + Ojos + Copy -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-1.5">
				<label for="rx-{pair.catalogItemId}-doctor" class="text-[10px] font-semibold text-outline uppercase"
					>Médico</label
				>
				<input
					id="rx-{pair.catalogItemId}-doctor"
					type="text"
					bind:value={draft.doctorName}
					placeholder="Nombre del doctor"
					class="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {draftRxErrs.doctorName
						? '!border-red-400'
						: ''}"
				/>
				{#if draftRxErrs.doctorName}<p class="text-[10px] text-red-500">{draftRxErrs.doctorName}</p>{/if}
			</div>
			<div class="flex items-center gap-1.5">
				<span class="text-[10px] font-semibold text-outline uppercase">Tipo</span>
				<span
					class="rounded-full bg-brand-blue/10 px-2.5 py-0.5 text-xs font-semibold text-brand-blue"
				>
					{getLensTypeLabel(draft.lensType)}
				</span>
			</div>
			<span class="text-[10px] font-semibold text-outline uppercase">Ojos</span>
			<label
				class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm"
			>
				<input
					type="checkbox"
					bind:checked={draft.od.enabled}
					class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
				/>
				<span>OD</span>
			</label>
			<label
				class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm"
			>
				<input
					type="checkbox"
					bind:checked={draft.oi.enabled}
					class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
				/>
				<span>OI</span>
			</label>
			<button
				type="button"
				onclick={handleCopyOiToOd}
				class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
			>
				<Copy class="h-3 w-3" />
				Copiar OI → OD
			</button>
		</div>

		<!-- Prescription table -->
		<div
			class="grid gap-x-1.5 gap-y-1"
			class:grid-cols-[3.5rem_repeat(6,1fr)]={requiresAddition}
			class:grid-cols-[3.5rem_repeat(5,1fr)]={!requiresAddition}
		>
			<div class="text-center text-[10px] font-semibold text-outline uppercase"></div>
			<div class="text-center text-[10px] font-semibold text-outline uppercase">ESF</div>
			<div class="text-center text-[10px] font-semibold text-outline uppercase">CIL</div>
			<div class="text-center text-[10px] font-semibold text-outline uppercase">EJE</div>
			{#if requiresAddition}
				<div class="text-center text-[10px] font-semibold text-outline uppercase">ADD</div>
			{/if}
			<div class="text-center text-[10px] font-semibold text-outline uppercase">DP</div>
			<div class="text-center text-[10px] font-semibold text-outline uppercase">DNP</div>

			<div
				class="flex items-center rounded-lg bg-rose-50/30 px-2 py-1.5 text-xs font-semibold text-rose-700"
			>
				OI
			</div>
			<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
				<input
					type="number"
					step="0.25"
					placeholder="-2.00"
					bind:value={draft.oi.prescription.sphere}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.oiSphere
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.oiSphere}<p class="text-[10px] text-red-500">{draftRxErrs.oiSphere}</p>{/if}
			</div>
			<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
				<input
					type="number"
					step="0.25"
					min={-10}
					max={0}
					placeholder="-0.50"
					bind:value={draft.oi.prescription.cylinder}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.oiCylinder
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.oiCylinder}<p class="text-[10px] text-red-500">{draftRxErrs.oiCylinder}</p>{/if}
			</div>
			<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
				<input
					type="number"
					step="1"
					min={0}
					max={180}
					placeholder="180"
					bind:value={draft.oi.prescription.axis}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.oiAxis
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.oiAxis}<p class="text-[10px] text-red-500">{draftRxErrs.oiAxis}</p>{/if}
			</div>
			{#if requiresAddition}
				<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
					<input
						type="number"
						step="0.25"
						min={0}
						max={5}
						placeholder="+1.50"
						bind:value={draft.oi.prescription.addition}
						class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.oiAddition
							? 'text-red-600'
							: ''}"
					/>{#if draftRxErrs.oiAddition}<p class="text-[10px] text-red-500">{draftRxErrs.oiAddition}</p>{/if}
				</div>
			{/if}
			<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="62"
					bind:value={draft.oi.dp}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.oiDp
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.oiDp}<p class="text-[10px] text-red-500">{draftRxErrs.oiDp}</p>{/if}
			</div>
			<div class="rounded-lg border border-rose-200/60 bg-rose-50/40 p-0.5">
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="30"
					bind:value={draft.oi.np}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.oiNp
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.oiNp}<p class="text-[10px] text-red-500">{draftRxErrs.oiNp}</p>{/if}
			</div>

			<div
				class="flex items-center rounded-lg bg-blue-50/30 px-2 py-1.5 text-xs font-semibold text-blue-700"
			>
				OD
			</div>
			<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
				<input
					type="number"
					step="0.25"
					placeholder="-2.00"
					bind:value={draft.od.prescription.sphere}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.odSphere
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.odSphere}<p class="text-[10px] text-red-500">{draftRxErrs.odSphere}</p>{/if}
			</div>
			<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
				<input
					type="number"
					step="0.25"
					min={-10}
					max={0}
					placeholder="-0.50"
					bind:value={draft.od.prescription.cylinder}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.odCylinder
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.odCylinder}<p class="text-[10px] text-red-500">{draftRxErrs.odCylinder}</p>{/if}
			</div>
			<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
				<input
					type="number"
					step="1"
					min={0}
					max={180}
					placeholder="180"
					bind:value={draft.od.prescription.axis}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.odAxis
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.odAxis}<p class="text-[10px] text-red-500">{draftRxErrs.odAxis}</p>{/if}
			</div>
			{#if requiresAddition}
				<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
					<input
						type="number"
						step="0.25"
						min={0}
						max={5}
						placeholder="+1.50"
						bind:value={draft.od.prescription.addition}
						class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.odAddition
							? 'text-red-600'
							: ''}"
					/>{#if draftRxErrs.odAddition}<p class="text-[10px] text-red-500">{draftRxErrs.odAddition}</p>{/if}
				</div>
			{/if}
			<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="62"
					bind:value={draft.od.dp}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.odDp
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.odDp}<p class="text-[10px] text-red-500">{draftRxErrs.odDp}</p>{/if}
			</div>
			<div class="rounded-lg border border-blue-200/60 bg-blue-50/40 p-0.5">
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="30"
					bind:value={draft.od.np}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none {draftRxErrs.odNp
						? 'text-red-600'
						: ''}"
				/>{#if draftRxErrs.odNp}<p class="text-[10px] text-red-500">{draftRxErrs.odNp}</p>{/if}
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">
			<button
				type="button"
				onclick={handleCancel}
				class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
			>
				Cancelar
			</button>
			<button
				type="button"
				onclick={handleApply}
				class="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy/90"
			>
				<Check class="h-3.5 w-3.5" />
				Aceptar
			</button>
		</div>
	{/snippet}
</SlideOver>
