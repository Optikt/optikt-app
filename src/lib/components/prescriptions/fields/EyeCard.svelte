<script lang="ts">
	import { Eye } from '@lucide/svelte';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from '../prescription-form';
	import EyeInput from './EyeInput.svelte';

	interface Props {
		data: PrescriptionFormData;
		side: 'od' | 'os';
		showAddition: boolean;
		issues: PrescriptionFieldIssues | undefined;
		namePrefix: string;
	}

	let { data, side, showAddition, issues, namePrefix }: Props = $props();
	const isRight = $derived(side === 'od');
	const title = $derived(isRight ? 'Ojo Derecho (OD)' : 'Ojo Izquierdo (OS)');
	const headerClass = $derived(isRight ? 'bg-brand-navy' : 'bg-brand-blue');
	const prefix = $derived(isRight ? 'od' : 'os');
	const spherePlaceholder = $derived(isRight ? '-2.00' : '-1.75');
	const cylinderPlaceholder = $derived(isRight ? '-0.50' : '-0.25');
	const axisPlaceholder = $derived(isRight ? '180' : '175');
</script>

<div
	class="overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-[var(--ds-shadow-md)]"
>
	<div class={`flex items-center justify-between ${headerClass} px-5 py-4`}>
		<h2 class="font-heading text-lg font-black tracking-[0.06em] text-white uppercase">
			{title}
		</h2>
		<Eye class="h-4 w-4 text-brand-gold" />
	</div>
	<div class="p-6">
		<div
			class="grid grid-cols-2 gap-4"
			class:lg:grid-cols-4={showAddition}
			class:lg:grid-cols-3={!showAddition}
		>
			<EyeInput
				{data}
				field={`${prefix}Sphere`}
				id={`${prefix}-sphere`}
				label="Esfera"
				placeholder={spherePlaceholder}
				{issues}
				{namePrefix}
			/>
			<EyeInput
				{data}
				field={`${prefix}Cylinder`}
				id={`${prefix}-cylinder`}
				label="Cilindro"
				placeholder={cylinderPlaceholder}
				{issues}
				{namePrefix}
			/>
			<EyeInput
				{data}
				field={`${prefix}Axis`}
				id={`${prefix}-axis`}
				label="Eje"
				placeholder={axisPlaceholder}
				{issues}
				{namePrefix}
			/>
			{#if showAddition}
				<EyeInput
					{data}
					field={`${prefix}Addition`}
					id={`${prefix}-addition`}
					label="Adición"
					placeholder="1.50"
					{issues}
					{namePrefix}
				/>
			{/if}
		</div>
	</div>
</div>
