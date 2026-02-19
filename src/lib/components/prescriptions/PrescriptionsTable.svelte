<script lang="ts">
	import { TableHeadCell, TableBodyCell, Badge } from 'flowbite-svelte';
	import { Eye, SquarePen, Star, Glasses } from '@lucide/svelte';
	import { DataTable, ActionButton } from '$lib/components/ui';
	import type { Prescription } from '$lib/server/db/schema';
	import { formatAxis, formatDate, formatLensType, formatOpticalValue, formatPd } from '$lib/utils';

	interface Props {
		prescriptions: Prescription[];
		loading?: boolean;
		onView?: (prescription: Prescription) => void;
		onEdit?: (prescription: Prescription) => void;
	}

	let { prescriptions, loading = false, onView, onEdit }: Props = $props();
</script>

<DataTable
	items={prescriptions}
	{loading}
	emptyIcon={Glasses}
	emptyTitle="No hay fórmulas registradas"
	emptyDescription="Agrega una receta para comenzar"
>
	{#snippet header()}
		<TableHeadCell class="font-semibold">Fecha</TableHeadCell>
		<TableHeadCell class="font-semibold">OD (Esfera/Cil/Eje/Add)</TableHeadCell>
		<TableHeadCell class="font-semibold">OS (Esfera/Cil/Eje/Add)</TableHeadCell>
		<TableHeadCell class="font-semibold">PD</TableHeadCell>
		<TableHeadCell class="font-semibold">Tipo</TableHeadCell>
		<TableHeadCell class="font-semibold">Doctor</TableHeadCell>
		<TableHeadCell class="font-semibold">Estado</TableHeadCell>
	{/snippet}

	{#snippet row(prescription)}
		<TableBodyCell class="font-medium whitespace-nowrap">
			{formatDate(prescription.prescriptionDate, { month: 'short' })}
		</TableBodyCell>
		<TableBodyCell>
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
		</TableBodyCell>
		<TableBodyCell>
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
		</TableBodyCell>
		<TableBodyCell class="whitespace-nowrap text-slate-600">
			{formatPd(prescription)}
		</TableBodyCell>
		<TableBodyCell class="whitespace-nowrap text-slate-600">
			{formatLensType(prescription.recommendedLensType)}
		</TableBodyCell>
		<TableBodyCell class="whitespace-nowrap text-slate-600">
			{prescription.doctorName ?? '—'}
		</TableBodyCell>
		<TableBodyCell>
			{#if prescription.isCurrent}
				<Badge color="green" class="text-xs">
					<Star class="me-1 h-3 w-3" />
					Actual
				</Badge>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
	{/snippet}

	{#snippet actions(prescription)}
		<ActionButton icon={Eye} title="Ver detalles" onclick={() => onView?.(prescription)} />
		<ActionButton
			icon={SquarePen}
			title="Editar"
			color="blue"
			onclick={() => onEdit?.(prescription)}
		/>
	{/snippet}
</DataTable>
