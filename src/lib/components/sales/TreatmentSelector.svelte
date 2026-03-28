<script lang="ts">
	import { Checkbox } from 'flowbite-svelte';
	import { Shield, TriangleAlert } from '@lucide/svelte';
	import {
		LensTreatmentAvailability,
		LENS_TREATMENT_LABELS,
		type CoreLensTreatmentCode
	} from '$lib/shared/contracts/lenses';
	import type { CatalogItemForPlanning } from '$lib/shared/planning';
	import { formatPrice } from '$lib/utils';

	interface Props {
		catalogItem: CatalogItemForPlanning;
		selected: CoreLensTreatmentCode[];
		onchange: (selected: CoreLensTreatmentCode[]) => void;
	}

	let { catalogItem, selected, onchange }: Props = $props();

	const visiblePolicies = $derived(
		catalogItem.treatmentPolicies.filter(
			(p) => p.availability !== LensTreatmentAvailability.NOT_AVAILABLE
		)
	);

	function toggleTreatment(code: CoreLensTreatmentCode, checked: boolean) {
		const next = checked ? [...selected, code] : selected.filter((c) => c !== code);
		onchange(next);
	}
</script>

{#if visiblePolicies.length > 0}
	<div class="flex flex-wrap items-center gap-2">
		{#each visiblePolicies as policy (policy.code)}
			{@const label = LENS_TREATMENT_LABELS[policy.code] ?? policy.code}
			{#if policy.availability === LensTreatmentAvailability.INHERENT}
				<span
					class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
				>
					<Shield class="h-3 w-3" />
					{label}
					<span class="text-emerald-500">— Incluido</span>
				</span>
			{:else if policy.availability === LensTreatmentAvailability.OPTIONAL_EXTRA}
				<label
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors {selected.includes(
						policy.code
					)
						? 'border-blue-300 bg-blue-50 text-blue-700'
						: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}"
				>
					<Checkbox
						checked={selected.includes(policy.code)}
						onchange={(e: Event) =>
							toggleTreatment(policy.code, (e.target as HTMLInputElement).checked)}
						class="h-3.5 w-3.5"
					/>
					{label}
					{#if policy.additionalPrice > 0}
						<span class="font-mono text-slate-400">+{formatPrice(policy.additionalPrice)}</span>
					{/if}
					{#if policy.requiresConfirmation}
						<span title="Requiere confirmación">
							<TriangleAlert class="h-3 w-3 text-amber-500" />
						</span>
					{/if}
				</label>
			{/if}
		{/each}
	</div>
{/if}
