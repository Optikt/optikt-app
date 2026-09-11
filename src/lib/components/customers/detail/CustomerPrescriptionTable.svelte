<script lang="ts">
	import { ChevronDown, FileText, Glasses, SquarePen, Star, Trash2 } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { slide } from 'svelte/transition';
	import { AppBadge, LensTypeBadge, TreatmentBadge } from '$lib/components/ui/badges';
	import { formatAxis, formatDate, formatDpNp, formatOpticalValue } from '$lib/utils';
	import type { Prescription } from '$lib/server/db/schema';
	import PrescriptionEyeDetail from './PrescriptionEyeDetail.svelte';

	interface Props {
		prescriptions: Prescription[];
		canAct: boolean;
		customerId: string;
		expandedId: string | null;
		onToggleExpand: (id: string) => void;
		onDelete: (prescription: Prescription) => void;
	}

	let { prescriptions, canAct, customerId, expandedId, onToggleExpand, onDelete }: Props = $props();

	function scrollPrescriptionIntoView(e: Event) {
		(e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
</script>

{#if prescriptions.length > 0}
	<div class="overflow-hidden rounded-xl border border-outline-variant/30">
		<table class="w-full">
			<thead>
				<tr class="border-b border-outline-variant bg-surface-container-high">
					<th
						class="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
						>Fecha</th
					>
					<th
						class="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
						>Tipo</th
					>
					<th
						class="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
						>OD</th
					>
					<th
						class="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
						>OS</th
					>
					<th
						class="px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
						>Estado</th
					>
					<th
						class="px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
						>Acciones</th
					>
				</tr>
			</thead>
			<tbody class="divide-y divide-outline-variant/20">
				{#each prescriptions as prescription (prescription.id)}
					<tr
						class="group cursor-pointer bg-surface-container-lowest transition-colors hover:bg-surface-container-low"
						onclick={() => onToggleExpand(prescription.id)}
					>
						<td class="px-4 py-3 text-sm font-medium whitespace-nowrap text-on-surface">
							{formatDate(prescription.prescriptionDate, { month: 'short' })}
						</td>
						<td class="px-4 py-3">
							{#if prescription.recommendedLensType}
								<LensTypeBadge type={prescription.recommendedLensType} />
							{:else}
								<span class="text-sm text-outline">-</span>
							{/if}
						</td>
						<td class="px-4 py-3 font-mono text-sm text-on-surface-variant">
							{formatOpticalValue(prescription.odSphere)}
							{formatOpticalValue(prescription.odCylinder)}
							{formatAxis(prescription.odAxis)}
						</td>
						<td class="px-4 py-3 font-mono text-sm text-on-surface-variant">
							{formatOpticalValue(prescription.osSphere)}
							{formatOpticalValue(prescription.osCylinder)}
							{formatAxis(prescription.osAxis)}
						</td>
						<td class="px-4 py-3">
							{#if prescription.isCurrent}
								<AppBadge variant="success" class="gap-1.5 leading-none">
									<Star class="mt-px h-3 w-3 shrink-0" />
									Actual
								</AppBadge>
							{:else}
								<span class="text-sm text-outline">-</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							<div class="flex items-center justify-end gap-1">
								{#if canAct}
									<button
										onclick={(e) => {
											e.stopPropagation();
											goto(
												resolve(`/customers/${customerId}/prescriptions/${prescription.id}/edit`)
											);
										}}
										class="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-brand-blue"
										title="Editar"
									>
										<SquarePen class="h-4 w-4" />
									</button>
									<button
										onclick={(e) => {
											e.stopPropagation();
											onDelete(prescription);
										}}
										class="rounded-md p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
										title="Eliminar"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
								<div
									class="ml-1 transition-transform duration-200 {expandedId === prescription.id
										? 'rotate-180'
										: ''}"
								>
									<ChevronDown class="h-4 w-4 text-on-surface-variant" />
								</div>
							</div>
						</td>
					</tr>
					{#if expandedId === prescription.id}
						<tr>
							<td colspan="6">
								<div
									transition:slide={{ duration: 200 }}
									onintroend={scrollPrescriptionIntoView}
									class="scroll-mt-24 bg-surface-container-low px-6 py-5"
								>
									<div class="grid gap-5 lg:grid-cols-2">
										<PrescriptionEyeDetail
											side="OD"
											sphere={prescription.odSphere}
											cylinder={prescription.odCylinder}
											axis={prescription.odAxis}
											addition={prescription.odAddition}
										/>
										<PrescriptionEyeDetail
											side="OS"
											sphere={prescription.osSphere}
											cylinder={prescription.osCylinder}
											axis={prescription.osAxis}
											addition={prescription.osAddition}
										/>
									</div>

									<div
										class="mt-4 flex flex-wrap items-center gap-5 text-sm text-on-surface-variant"
									>
										<span><strong>DP/NP:</strong> {formatDpNp(prescription)}</span>
										{#if prescription.odAltura != null || prescription.osAltura != null}
											<span
												><strong>Altura:</strong>
												{prescription.odAltura != null ? `OD ${prescription.odAltura}mm` : 'OD —'}
												/
												{prescription.osAltura != null
													? `OI ${prescription.osAltura}mm`
													: 'OI —'}</span
											>
										{/if}
										{#if prescription.doctorName}
											<span><strong>Doctor:</strong> {prescription.doctorName}</span>
										{/if}
									</div>

									{#if prescription.treatments}
										<div class="mt-3 flex flex-wrap gap-1.5">
											{#if prescription.treatments.antiReflective}
												<TreatmentBadge type="antiReflective" />
											{/if}
											{#if prescription.treatments.blueBlock}
												<TreatmentBadge type="blueBlock" />
											{/if}
											{#if prescription.treatments.photochromic}
												<TreatmentBadge type="photochromic" />
											{/if}
											{#if prescription.treatments.other}
												<span
													class="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface-variant"
												>
													{prescription.treatments.other}
												</span>
											{/if}
										</div>
									{/if}

									{#if prescription.notes}
										<div class="mt-3 rounded-lg bg-surface-container p-3">
											<div class="flex items-start gap-2">
												<FileText class="mt-0.5 h-3.5 w-3.5 text-outline" />
												<p class="text-xs whitespace-pre-wrap text-on-surface-variant">
													{prescription.notes}
												</p>
											</div>
										</div>
									{/if}
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface py-12 text-center"
	>
		<Glasses class="mb-3 h-10 w-10 text-outline" />
		<p class="font-medium text-on-surface-variant">No hay fórmulas registradas</p>
		<p class="mt-1 text-sm text-outline">Agrega una fórmula para comenzar</p>
	</div>
{/if}
