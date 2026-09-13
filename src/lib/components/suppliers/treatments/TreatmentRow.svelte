<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { treatmentCategoryBadgeClass } from './treatmentBadges';
	import type { SupplierTreatment } from '$lib/server/db/schema';

	interface Props {
		treatment: SupplierTreatment;
		canManage: boolean;
		onEdit: (treatment: SupplierTreatment) => void;
		onDelete: (treatment: SupplierTreatment) => void;
	}

	let { treatment, canManage, onEdit, onDelete }: Props = $props();
</script>

<div class="flex items-center gap-3 px-4 py-3">
	<div class="flex-1">
		<span class="text-sm font-medium text-slate-800">{treatment.name}</span>
	</div>
	<span
		class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
		{treatmentCategoryBadgeClass(treatment.category)}"
	>
		{getTreatmentCategoryLabel(treatment.category)}
	</span>
	{#if treatment.isTaxable}
		<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
			>IVA</span
		>
	{/if}
	<span class="text-right font-mono text-xs text-slate-400" title="Costo">
		{formatPrice(treatment.price)}
	</span>
	<span class="w-24 text-right font-mono text-sm font-medium text-slate-700" title="Precio Venta">
		{formatPrice(treatment.salePrice ?? treatment.price)}
	</span>
	{#if canManage}
		<div class="flex gap-1">
			<button
				type="button"
				class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
				onclick={() => onEdit(treatment)}
			>
				<Pencil class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				class="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
				onclick={() => onDelete(treatment)}
			>
				<Trash2 class="h-3.5 w-3.5" />
			</button>
		</div>
	{/if}
</div>
