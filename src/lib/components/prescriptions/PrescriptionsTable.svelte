<script lang="ts">
	import { Star, Glasses, Eye, SquarePen } from '@lucide/svelte';
	import { DataTable } from '$lib/components/ui';
	import type { Prescription } from '$lib/server/db/schema';
	import {
		formatAxis,
		formatDate,
		formatLensType,
		formatOpticalValue,
		formatDpNp
	} from '$lib/utils';

	interface Props {
		prescriptions: Prescription[];
		loading?: boolean;
		onView?: (prescription: Prescription) => void;
		onEdit?: (prescription: Prescription) => void;
		refetch?: () => void | Promise<void>;
	}

	let { prescriptions, loading = false, onView, onEdit, refetch }: Props = $props();
</script>

<DataTable
	items={prescriptions}
	{loading}
	{refetch}
	emptyIcon={Glasses}
	emptyTitle="No hay fórmulas registradas"
	emptyDescription="Agrega una fórmula para comenzar"
	defaultActions="view,edit"
	{onView}
	{onEdit}
	viewIcon={Eye}
	editIcon={SquarePen}
>
	{#snippet header()}
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Fecha</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">OD (Esfera/Cil/Eje/Add)</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">OS (Esfera/Cil/Eje/Add)</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">DP/NP</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Tipo</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Doctor</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Estado</th>
	{/snippet}

	{#snippet row(prescription)}
		<td class="font-medium whitespace-nowrap px-4 py-3 text-sm">
			{formatDate(prescription.prescriptionDate, { month: 'short' })}
		</td>
		<td class="px-4 py-3 text-sm">
			<div class="flex flex-wrap gap-1 text-xs">
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatOpticalValue(prescription.odSphere)}
				</span>
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatOpticalValue(prescription.odCylinder)}
				</span>
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatAxis(prescription.odAxis)}
				</span>
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatOpticalValue(prescription.odAddition)}
				</span>
			</div>
		</td>
		<td class="px-4 py-3 text-sm">
			<div class="flex flex-wrap gap-1 text-xs">
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatOpticalValue(prescription.osSphere)}
				</span>
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatOpticalValue(prescription.osCylinder)}
				</span>
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatAxis(prescription.osAxis)}
				</span>
				<span class="rounded bg-slate-100 px-1.5 py-0.5">
					{formatOpticalValue(prescription.osAddition)}
				</span>
			</div>
		</td>
		<td class="whitespace-nowrap text-slate-600 px-4 py-3 text-sm">
			{formatDpNp(prescription)}
		</td>
		<td class="whitespace-nowrap text-slate-600 px-4 py-3 text-sm">
			{formatLensType(prescription.recommendedLensType)}
		</td>
		<td class="whitespace-nowrap text-slate-600 px-4 py-3 text-sm">
			{prescription.doctorName ?? '-'}
		</td>
		<td class="px-4 py-3 text-sm">
			{#if prescription.isCurrent}
				<span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
					<Star class="me-1 h-3 w-3" />
					Actual
				</span>
			{:else}
				<span class="text-slate-400">-</span>
			{/if}
		</td>
	{/snippet}
</DataTable>
