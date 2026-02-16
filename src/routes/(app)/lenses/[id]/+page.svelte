<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { Badge, Button } from 'flowbite-svelte';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		History,
		Eye,
		Shield,
		Sun,
		Layers,
		Package,
		Truck,
		FlaskConical,
		Target
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatPrice, formatDate } from '$lib/utils';
	import { untrack } from 'svelte';
	import { ConfirmModal } from '$lib/components/ui';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { getErrorMessage } from '$lib/utils';
	import {
		LensType,
		LensCatalogSource,
		LENS_TYPE_LABELS,
		LENS_SOURCE_LABELS
	} from '$lib/shared/enums';
	import type { LensOpticalRange } from '$lib/server/db/schema/lenses';

	let { data } = $props();
	const item = untrack(() => data.item);

	// Delete modal state
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);

	// History modal state
	let showHistoryModal = $state(false);

	// Related names map for history display
	const relatedNames = $derived({
		...(item.supplier ? { [item.supplier.id]: item.supplier.name } : {}),
		...(item.material ? { [item.material.id]: item.material.name } : {})
	});

	function getProfitMargin(base: number, sale: number | null, mounting: number | null): string {
		if (!sale) return '—';
		const totalCost = base + (mounting ?? 0);
		if (totalCost === 0) return '—';
		return (((sale - totalCost) / totalCost) * 100).toFixed(1) + '%';
	}

	// Optical range formatting
	function formatDiopter(n: number): string {
		return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
	}

	function formatRange(min: number | null, max: number | null): string {
		if (min === null && max === null) return '—';
		if (min !== null && max !== null) return `${formatDiopter(min)} a ${formatDiopter(max)}`;
		if (min !== null) return `desde ${formatDiopter(min)}`;
		return `hasta ${formatDiopter(max!)}`;
	}

	/** Format cylinder range for display: show closer-to-zero value first (e.g. -0.25 a -2.00) */
	function formatCylinderRange(min: number | null, max: number | null): string {
		return formatRange(max, min);
	}

	function formatSymmetricSphere(absMin: number, absMax: number): string {
		if (absMin === 0) return `±${absMax.toFixed(2)}`;
		return `±${absMin.toFixed(2)} a ±${absMax.toFixed(2)}`;
	}

	type DisplayRange = {
		id: string;
		symmetric: boolean;
		sphereLabel: string;
		cylinderLabel: string | null;
		additionLabel: string | null;
	};

	function collapseRangesForDisplay(ranges: LensOpticalRange[]): DisplayRange[] {
		const result: DisplayRange[] = [];
		const groups = new SvelteMap<string, LensOpticalRange[]>();
		const standalone: LensOpticalRange[] = [];

		for (const r of ranges) {
			if (r.mirrorGroup) {
				const group = groups.get(r.mirrorGroup) ?? [];
				group.push(r);
				groups.set(r.mirrorGroup, group);
			} else {
				standalone.push(r);
			}
		}

		for (const [groupId, rows] of groups) {
			if (rows.length === 1) {
				const r = rows[0];
				result.push({
					id: groupId,
					symmetric: false,
					sphereLabel: formatRange(r.sphereMin, r.sphereMax),
					cylinderLabel:
						r.cylinderMin != null || r.cylinderMax != null
							? formatCylinderRange(r.cylinderMin ?? null, r.cylinderMax ?? null)
							: null,
					additionLabel:
						r.additionMin != null || r.additionMax != null
							? formatRange(r.additionMin ?? null, r.additionMax ?? null)
							: null
				});
			} else {
				const pos = rows.find((r) => r.sphereMin >= 0) ?? rows[0];
				const absMin = Math.abs(pos.sphereMin);
				const absMax = Math.abs(pos.sphereMax);
				result.push({
					id: groupId,
					symmetric: true,
					sphereLabel: formatSymmetricSphere(absMin, absMax),
					cylinderLabel:
						pos.cylinderMin != null || pos.cylinderMax != null
							? formatCylinderRange(pos.cylinderMin ?? null, pos.cylinderMax ?? null)
							: null,
					additionLabel:
						pos.additionMin != null || pos.additionMax != null
							? formatRange(pos.additionMin ?? null, pos.additionMax ?? null)
							: null
				});
			}
		}

		for (const r of standalone) {
			result.push({
				id: r.id,
				symmetric: false,
				sphereLabel: formatRange(r.sphereMin, r.sphereMax),
				cylinderLabel:
					r.cylinderMin != null || r.cylinderMax != null
						? formatCylinderRange(r.cylinderMin ?? null, r.cylinderMax ?? null)
						: null,
				additionLabel:
					r.additionMin != null || r.additionMax != null
						? formatRange(r.additionMin ?? null, r.additionMax ?? null)
						: null
			});
		}

		return result;
	}

	const displayRanges = collapseRangesForDisplay(item.ranges);

	// Features list
	const features = $derived.by(() => {
		const list: { label: string; icon: typeof Sun; active: boolean }[] = [
			{ label: 'Fotocromático', icon: Sun, active: item.isPhotochromic },
			{ label: 'Blue Cut', icon: Shield, active: item.isBlueCut },
			{ label: 'Anti-Reflejo', icon: Eye, active: item.isAR }
		];
		return list;
	});

	async function confirmDelete() {
		deleteLoading = true;
		try {
			await deleteLensCatalogItemById({ id: item.id });
			toast.success('Lente eliminado correctamente');
			goto(resolve('/lenses'));
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando lente'));
		} finally {
			deleteLoading = false;
			showDeleteModal = false;
		}
	}
</script>

<svelte:head>
	<title>{item.name} - Catálogo de Lentes - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-4 sm:p-8">
	<div class="mx-auto max-w-5xl">
		<!-- Back link -->
		<a
			href={resolve('/lenses')}
			class="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver al catálogo
		</a>

		<!-- Header Section -->
		<div class="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2.5">
						<h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
							{item.name}
						</h1>
						{#if !item.isActive}
							<Badge color="red">Inactivo</Badge>
						{/if}
					</div>
					{#if item.brand || item.technology}
						<div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
							{#if item.brand}
								<span class="font-medium text-slate-600">{item.brand}</span>
							{/if}
							{#if item.brand && item.technology}
								<span class="text-slate-300">|</span>
							{/if}
							{#if item.technology}
								<span>{item.technology}</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="flex flex-shrink-0 gap-2">
					<Button size="sm" color="light" onclick={() => (showHistoryModal = true)}>
						<History class="mr-1.5 h-4 w-4" />
						Historial
					</Button>
					<Button size="sm" color="alternative" href={`/lenses/${item.id}/edit`}>
						<Pencil class="mr-1.5 h-4 w-4" />
						Editar
					</Button>
					<Button size="sm" color="red" outline onclick={() => (showDeleteModal = true)}>
						<Trash2 class="mr-1.5 h-4 w-4" />
						Eliminar
					</Button>
				</div>
			</div>
		</div>

		<!-- Content Grid -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Main content (2 cols) -->
			<div class="space-y-6 lg:col-span-2">
				<!-- General Info + Features Card (condensed) -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-800">
						<FlaskConical class="h-5 w-5 text-indigo-500" />
						Información General
					</h3>
					<dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-slate-500">Proveedor</dt>
							<dd class="mt-0.5 text-slate-800">
								{#if item.supplier}
									<a
										href={resolve(`/suppliers`)}
										class="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
									>
										{item.supplier.name}
									</a>
								{:else}
									<span class="text-slate-400">—</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-slate-500">Material</dt>
							<dd class="mt-0.5 text-slate-800">
								{#if item.material}
									<span class="font-medium">{item.material.name}</span>
									<span class="ml-1 text-xs text-slate-400">({item.material.code})</span>
								{:else}
									<span class="text-slate-400">—</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-slate-500">Índice de Refracción</dt>
							<dd class="mt-0.5 font-mono text-slate-800">
								{item.refractiveIndex?.toFixed(2) ?? '—'}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-slate-500">Tipo de Lente</dt>
							<dd class="mt-0.5 text-slate-800">
								{LENS_TYPE_LABELS[item.type as LensType] ?? item.type}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-slate-500">Origen</dt>
							<dd class="mt-0.5 text-slate-800">
								{LENS_SOURCE_LABELS[item.source as LensCatalogSource] ?? item.source}
							</dd>
						</div>
						{#if item.deliveryDays != null}
							<div>
								<dt class="text-sm font-medium text-slate-500">Tiempo de Entrega</dt>
								<dd class="mt-0.5 text-slate-800">
									<span class="inline-flex items-center gap-1.5">
										<Truck class="h-3.5 w-3.5 text-slate-400" />
										{item.deliveryDays}
										{item.deliveryDays === 1 ? 'día' : 'días'}
									</span>
								</dd>
							</div>
						{/if}
					</dl>

					<!-- Characteristics section within the same card -->
					<div class="mt-6 border-t border-slate-100 pt-5">
						<h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
							<Layers class="h-4 w-4 text-violet-500" />
							Características
						</h4>
						<div class="flex flex-wrap gap-2.5">
							{#each features as feat (feat.label)}
								<div
									class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium {feat.active
										? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
										: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'}"
								>
									<feat.icon class="h-3.5 w-3.5" />
									{feat.label}
									{#if feat.active}
										<span
											class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white"
											>✓</span
										>
									{:else}
										<span
											class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-400"
											>✕</span
										>
									{/if}
								</div>
							{/each}
						</div>
						{#if item.baseFeatures && item.baseFeatures.length > 0}
							<div class="mt-3 flex flex-wrap gap-1.5">
								{#each item.baseFeatures as feature (feature)}
									<span
										class="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
									>
										{feature}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Optical Ranges Card -->
				{#if displayRanges.length > 0}
					<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 class="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-800">
							<Target class="h-5 w-5 text-blue-500" />
							Rangos Ópticos
							<span
								class="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
							>
								{displayRanges.length}
							</span>
						</h3>

						<div class="space-y-3">
							{#each displayRanges as range, i (range.id)}
								<div
									class="rounded-lg border border-slate-100 bg-slate-50/80 p-4 transition-colors hover:bg-slate-50"
								>
									<div class="mb-2 flex items-center gap-2">
										<span
											class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
										>
											{i + 1}
										</span>
										{#if range.symmetric}
											<Badge color="purple" class="text-xs">Simétrico ±</Badge>
										{/if}
									</div>
									<div
										class="grid gap-4"
										class:sm:grid-cols-2={!range.additionLabel}
										class:sm:grid-cols-3={!!range.additionLabel}
									>
										<div>
											<dt class="text-xs font-medium tracking-wider text-slate-400 uppercase">
												Esfera
											</dt>
											<dd class="mt-0.5 font-mono text-sm font-semibold text-slate-800">
												{range.sphereLabel}
											</dd>
										</div>
										{#if range.cylinderLabel}
											<div>
												<dt class="text-xs font-medium tracking-wider text-slate-400 uppercase">
													Cilindro
												</dt>
												<dd class="mt-0.5 font-mono text-sm font-semibold text-slate-800">
													{range.cylinderLabel}
												</dd>
											</div>
										{/if}
										{#if range.additionLabel}
											<div>
												<dt class="text-xs font-medium tracking-wider text-slate-400 uppercase">
													Adición
												</dt>
												<dd class="mt-0.5 font-mono text-sm font-semibold text-slate-800">
													{range.additionLabel}
												</dd>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Notes -->
				{#if item.notes}
					<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 class="mb-3 text-lg font-semibold text-slate-800">Notas</h3>
						<p class="whitespace-pre-wrap text-slate-600">{item.notes}</p>
					</div>
				{/if}
			</div>

			<!-- Sidebar (1 col) -->
			<div class="space-y-6">
				<!-- Pricing + Stock + Metadata (condensed into one card) -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<!-- Sale price hero -->
					{#if item.salePrice != null}
						<div class="mb-4 rounded-lg bg-blue-50 p-5 text-center">
							<dt class="text-sm font-medium text-blue-600">Precio Venta</dt>
							<dd class="mt-1 font-mono text-3xl font-bold text-blue-700">
								{formatPrice(item.salePrice)}
							</dd>
						</div>
					{/if}

					<!-- Cost breakdown grid -->
					<div class="mb-4 grid grid-cols-2 gap-3">
						<div class="rounded-lg bg-slate-50 p-3">
							<dt class="text-xs text-slate-500">Precio Base</dt>
							<dd class="mt-0.5 font-mono text-base font-medium text-slate-700">
								{formatPrice(item.basePrice)}
							</dd>
						</div>
						<div class="rounded-lg bg-amber-50 p-3">
							<dt class="text-xs text-amber-600">Montaje</dt>
							<dd class="mt-0.5 font-mono text-base font-medium text-amber-700">
								{item.mountingPrice != null ? formatPrice(item.mountingPrice) : '—'}
							</dd>
						</div>
					</div>

					<!-- Margin -->
					<div class="mb-5 rounded-lg bg-green-50 p-3">
						<div class="flex items-center justify-between">
							<dt class="text-sm text-green-600">Margen Neto</dt>
							<dd class="text-xl font-bold text-green-700">
								{getProfitMargin(item.basePrice, item.salePrice, item.mountingPrice)}
							</dd>
						</div>
						{#if item.salePrice != null}
							<p class="mt-1 text-xs text-green-600/70">
								Ganancia: {formatPrice(item.salePrice - item.basePrice - (item.mountingPrice ?? 0))} por
								lente
							</p>
						{/if}
					</div>

					<!-- Stock + Metadata -->
					<div class="border-t border-slate-100 pt-4">
						<div class="mb-4 flex items-center justify-between">
							<span class="flex items-center gap-1.5 text-sm font-medium text-slate-500">
								<Package class="h-4 w-4 text-teal-500" />
								Stock
							</span>
							<span class="text-xl font-bold text-slate-900">{item.stock ?? '—'}</span>
						</div>
					</div>

					<div class="border-t border-slate-100 pt-4">
						<h4 class="mb-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">
							Sistema
						</h4>
						<dl class="space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<dt class="text-slate-500">ID</dt>
								<dd class="max-w-[180px] truncate font-mono text-xs text-slate-600">{item.id}</dd>
							</div>
							<div class="flex items-center justify-between">
								<dt class="text-slate-500">Creado</dt>
								<dd class="text-slate-700">{formatDate(item.createdAt)}</dd>
							</div>
							<div class="flex items-center justify-between">
								<dt class="text-slate-500">Actualizado</dt>
								<dd class="text-slate-700">{formatDate(item.updatedAt)}</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Lente"
	message="¿Estás seguro de que deseas eliminar este lente del catálogo? Esta acción puede ser revertida."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={confirmDelete}
	onCancel={() => (showDeleteModal = false)}
/>

<!-- History Modal -->
<ChangeHistoryModal
	bind:open={showHistoryModal}
	title={item.name}
	entityType="lens_catalog_item"
	entityId={item.id}
	{relatedNames}
/>
