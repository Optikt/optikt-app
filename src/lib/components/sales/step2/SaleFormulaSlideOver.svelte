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

	const errorsByEye = $derived.by(() => {
		const od: string[] = [];
		const oi: string[] = [];
		const general: string[] = [];

		for (const [key, msg] of Object.entries(draftRxErrs)) {
			if (key.startsWith('od')) od.push(msg);
			else if (key.startsWith('oi')) oi.push(msg);
			else general.push(msg);
		}

		const groups: { label: string; errors: string[] }[] = [];
		if (general.length > 0) groups.push({ label: '', errors: general });
		if (od.length > 0) groups.push({ label: 'OD', errors: od });
		if (oi.length > 0) groups.push({ label: 'OI', errors: oi });
		return groups;
	});

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
				<label
					for="rx-{pair.catalogItemId}-doctor"
					class="text-[10px] font-semibold text-outline uppercase">Médico</label
				>
				<input
					id="rx-{pair.catalogItemId}-doctor"
					type="text"
					bind:value={draft.doctorName}
					placeholder="Nombre del doctor"
					class="w-36 rounded-lg border bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {draftRxErrs.doctorName
						? 'border-red-300'
						: 'border-slate-200'}"
				/>
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
			<div
				class="rounded-lg border bg-rose-50/40 p-0.5 {draftRxErrs.oiSphere
					? 'border-red-300'
					: 'border-rose-200/60'}"
			>
				<input
					type="number"
					step="0.25"
					placeholder="-2.00"
					bind:value={draft.oi.prescription.sphere}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			<div
				class="rounded-lg border bg-rose-50/40 p-0.5 {draftRxErrs.oiCylinder
					? 'border-red-300'
					: 'border-rose-200/60'}"
			>
				<input
					type="number"
					step="0.25"
					min={-10}
					max={0}
					placeholder="-0.50"
					bind:value={draft.oi.prescription.cylinder}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			<div
				class="rounded-lg border bg-rose-50/40 p-0.5 {draftRxErrs.oiAxis
					? 'border-red-300'
					: 'border-rose-200/60'}"
			>
				<input
					type="number"
					step="1"
					min={0}
					max={180}
					placeholder="180"
					bind:value={draft.oi.prescription.axis}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			{#if requiresAddition}
				<div
					class="rounded-lg border bg-rose-50/40 p-0.5 {draftRxErrs.oiAddition
						? 'border-red-300'
						: 'border-rose-200/60'}"
				>
					<input
						type="number"
						step="0.25"
						min={0}
						max={5}
						placeholder="+1.50"
						bind:value={draft.oi.prescription.addition}
						class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
					/>
				</div>
			{/if}
			<div
				class="rounded-lg border bg-rose-50/40 p-0.5 {draftRxErrs.oiDp
					? 'border-red-300'
					: 'border-rose-200/60'}"
			>
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="62"
					bind:value={draft.oi.dp}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			<div
				class="rounded-lg border bg-rose-50/40 p-0.5 {draftRxErrs.oiNp
					? 'border-red-300'
					: 'border-rose-200/60'}"
			>
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="30"
					bind:value={draft.oi.np}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>

			<div
				class="flex items-center rounded-lg bg-blue-50/30 px-2 py-1.5 text-xs font-semibold text-blue-700"
			>
				OD
			</div>
			<div
				class="rounded-lg border bg-blue-50/40 p-0.5 {draftRxErrs.odSphere
					? 'border-red-300'
					: 'border-blue-200/60'}"
			>
				<input
					type="number"
					step="0.25"
					placeholder="-2.00"
					bind:value={draft.od.prescription.sphere}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			<div
				class="rounded-lg border bg-blue-50/40 p-0.5 {draftRxErrs.odCylinder
					? 'border-red-300'
					: 'border-blue-200/60'}"
			>
				<input
					type="number"
					step="0.25"
					min={-10}
					max={0}
					placeholder="-0.50"
					bind:value={draft.od.prescription.cylinder}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			<div
				class="rounded-lg border bg-blue-50/40 p-0.5 {draftRxErrs.odAxis
					? 'border-red-300'
					: 'border-blue-200/60'}"
			>
				<input
					type="number"
					step="1"
					min={0}
					max={180}
					placeholder="180"
					bind:value={draft.od.prescription.axis}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			{#if requiresAddition}
				<div
					class="rounded-lg border bg-blue-50/40 p-0.5 {draftRxErrs.odAddition
						? 'border-red-300'
						: 'border-blue-200/60'}"
				>
					<input
						type="number"
						step="0.25"
						min={0}
						max={5}
						placeholder="+1.50"
						bind:value={draft.od.prescription.addition}
						class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
					/>
				</div>
			{/if}
			<div
				class="rounded-lg border bg-blue-50/40 p-0.5 {draftRxErrs.odDp
					? 'border-red-300'
					: 'border-blue-200/60'}"
			>
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="62"
					bind:value={draft.od.dp}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
			<div
				class="rounded-lg border bg-blue-50/40 p-0.5 {draftRxErrs.odNp
					? 'border-red-300'
					: 'border-blue-200/60'}"
			>
				<input
					type="number"
					step="1"
					min={10}
					max={80}
					placeholder="30"
					bind:value={draft.od.np}
					class="w-full rounded border-0 bg-transparent px-1 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-none"
				/>
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="border-t border-slate-200 px-6 py-3">
			{#if Object.keys(draftRxErrs).length > 0}
				<div class="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
					<p class="mb-1 font-semibold">
						{Object.keys(draftRxErrs).length === 1
							? '1 error pendiente'
							: `${Object.keys(draftRxErrs).length} errores pendientes`}
					</p>
					{#each errorsByEye as group}
						{#if group.label}
							<p class="mb-0.5 mt-1 text-[11px] font-semibold tracking-wider text-red-800 uppercase">{group.label}</p>
						{/if}
						<ul class="list-inside list-disc space-y-0.5">
							{#each group.errors as msg}
								<li class="text-red-600">{msg}</li>
							{/each}
						</ul>
					{/each}
				</div>
			{/if}
			<div class="flex items-center justify-end gap-2">
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
					disabled={Object.keys(draftRxErrs).length > 0}
					class="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Check class="h-3.5 w-3.5" />
					Aceptar
				</button>
			</div>
		</div>
	{/snippet}
</SlideOver>
