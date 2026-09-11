<script lang="ts">
	import { Glasses, Plus, Star } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { LensTypeBadge } from '$lib/components/ui/badges';
	import { formatDate, formatDpNp, formatOpticalValue } from '$lib/utils';
	import type { Prescription } from '$lib/server/db/schema';

	interface Props {
		prescription: Prescription | null;
		canAct: boolean;
		customerId: string;
	}

	let { prescription, canAct, customerId }: Props = $props();
</script>

{#if prescription}
	<div class="rounded-xl bg-brand-navy p-6">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<Star class="h-5 w-5 text-brand-gold" />
				<h2 class="text-[11px] font-bold tracking-widest text-brand-gold uppercase">
					Fórmula Activa
				</h2>
			</div>
			<span class="text-xs text-white/60">{formatDate(prescription.prescriptionDate)}</span>
		</div>

		{#if prescription.recommendedLensType || prescription.doctorName}
			<div class="mb-4 grid gap-3 border-b border-white/10 pb-4 sm:grid-cols-2">
				{#if prescription.recommendedLensType}
					<div class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
						<span class="text-[11px] font-bold tracking-[0.18em] text-white/55 uppercase">
							Tipo de Lente
						</span>
						<LensTypeBadge type={prescription.recommendedLensType} class="shrink-0" />
					</div>
				{/if}
				{#if prescription.doctorName}
					<div class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
						<span class="text-[11px] font-bold tracking-[0.18em] text-white/55 uppercase">
							Doctor
						</span>
						<span class="truncate text-right text-sm font-medium text-white">
							{prescription.doctorName}
						</span>
					</div>
				{/if}
			</div>
		{/if}

		<div class="mb-3 rounded-xl bg-white/10 p-4">
			<div class="mb-2 flex items-center gap-2">
				<div
					class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-[9px] font-bold text-brand-navy"
				>
					OD
				</div>
				<span class="text-xs font-bold tracking-wider text-white/80 uppercase">Ojo Derecho</span>
			</div>
			<p class="font-mono text-base font-medium text-white">
				{formatOpticalValue(prescription.odSphere)}
				{formatOpticalValue(prescription.odCylinder)}
				{#if prescription.odAxis != null}x{prescription.odAxis}°{/if}
			</p>
			{#if prescription.odAddition != null}
				<p class="mt-0.5 font-mono text-sm text-white/60">
					Add: {formatOpticalValue(prescription.odAddition)}
				</p>
			{/if}
		</div>

		<div class="mb-4 rounded-xl bg-white/10 p-4">
			<div class="mb-2 flex items-center gap-2">
				<div
					class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-[9px] font-bold text-white"
				>
					OS
				</div>
				<span class="text-xs font-bold tracking-wider text-white/80 uppercase">Ojo Izquierdo</span>
			</div>
			<p class="font-mono text-base font-medium text-white">
				{formatOpticalValue(prescription.osSphere)}
				{formatOpticalValue(prescription.osCylinder)}
				{#if prescription.osAxis != null}x{prescription.osAxis}°{/if}
			</p>
			{#if prescription.osAddition != null}
				<p class="mt-0.5 font-mono text-sm text-white/60">
					Add: {formatOpticalValue(prescription.osAddition)}
				</p>
			{/if}
		</div>

		<div class="mt-4 space-y-4 border-t border-white/10 pt-4">
			<div class="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
				<div class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
					<span>DP/NP</span>
					<span class="font-mono text-white">{formatDpNp(prescription)}</span>
				</div>
				{#if prescription.odAltura != null || prescription.osAltura != null}
					<div class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
						<span>Altura</span>
						<span class="font-mono text-white"
							>{prescription.odAltura != null ? `OD ${prescription.odAltura}mm` : '—'}
							/ {prescription.osAltura != null ? `OI ${prescription.osAltura}mm` : '—'}</span
						>
					</div>
				{/if}
			</div>

			{#if prescription.treatments}
				<div class="flex flex-wrap gap-2">
					{#if prescription.treatments.antiReflective}
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
							>Antireflejo</span
						>
					{/if}
					{#if prescription.treatments.blueBlock}
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
							>Blue Block</span
						>
					{/if}
					{#if prescription.treatments.photochromic}
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
							>Fotocromático</span
						>
					{/if}
					{#if prescription.treatments.other}
						<span class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
							>{prescription.treatments.other}</span
						>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex flex-col items-center justify-center rounded-xl bg-brand-navy p-8 text-center">
		<Glasses class="mb-3 h-10 w-10 text-white/30" />
		<p class="text-sm font-medium text-white/60">Sin fórmula activa</p>
		{#if canAct}
			<button
				onclick={() => goto(resolve(`/customers/${customerId}/prescriptions/new`))}
				class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-bold text-brand-navy shadow-sm hover:bg-brand-gold-dark hover:shadow-md"
			>
				<Plus class="h-3.5 w-3.5" />
				Agregar Fórmula
			</button>
		{/if}
	</div>
{/if}
