<script lang="ts">
	import { Ruler } from '@lucide/svelte';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from '../prescription-form';
	import MeasurementInput from './MeasurementInput.svelte';

	interface Props {
		data: PrescriptionFormData;
		showAltura: boolean;
		issues: PrescriptionFieldIssues | undefined;
		namePrefix: string;
	}

	let { data, showAltura, issues, namePrefix }: Props = $props();
</script>

<section
	class="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-sm)]"
>
	<div class="mb-6 flex items-center gap-3">
		<span
			class="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-blue/12 text-brand-blue"
		>
			<Ruler class="h-4 w-4" />
		</span>
		<h3 class="text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase">Distancias</h3>
	</div>

	<div
		class="grid gap-4 sm:grid-cols-2"
		class:xl:grid-cols-5={showAltura}
		class:xl:grid-cols-3={!showAltura}
	>
		<MeasurementInput
			{data}
			field="dp"
			id="rx-dp"
			label="DP (mm)"
			placeholder="62"
			{issues}
			{namePrefix}
		/>
		<MeasurementInput
			{data}
			field="npRight"
			id="rx-np-right"
			label="NP Der"
			placeholder="31"
			{issues}
			{namePrefix}
		/>
		<MeasurementInput
			{data}
			field="npLeft"
			id="rx-np-left"
			label="NP Izq"
			placeholder="31"
			{issues}
			{namePrefix}
		/>

		{#if showAltura}
			<MeasurementInput
				{data}
				field="odAltura"
				id="rx-od-altura"
				label="Alt Der"
				placeholder="18"
				{issues}
				{namePrefix}
			/>
			<MeasurementInput
				{data}
				field="osAltura"
				id="rx-os-altura"
				label="Alt Izq"
				placeholder="18"
				{issues}
				{namePrefix}
			/>
		{/if}
	</div>
</section>
