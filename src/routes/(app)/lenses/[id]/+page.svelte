<script lang="ts">
	import { Pencil, Trash2, ArrowRightLeft, History, Package } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import LensDetailOpticalPanel from '$lib/components/lenses/detail/LensDetailOpticalPanel.svelte';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { isAdminRole } from '$lib/shared/enums';
	import { getPriceTypeLabel, getInventoryModeLabel, getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { getErrorMessage, formatPrice, formatDate } from '$lib/utils';
	import { getLensMarginPercent, getLensInventorySummary, getLensTaxSummary } from '$lib/components/lenses/detail/helpers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { item } = untrack(() => data);

	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let showHistoryModal = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	const marginPercent = $derived(getLensMarginPercent(item.pairPurchasePrice, item.salePrice));
	const inventorySummary = $derived(getLensInventorySummary(item.inventoryMode, item.stock));
	const refractiveIndexLabel = $derived(
		item.material?.refractiveIndex != null ? item.material.refractiveIndex.toFixed(2) : null
	);

	const relatedNames = $derived({
		...(item.supplier ? { [item.supplier.id]: item.supplier.name } : {}),
		...(item.material ? { [item.material.id]: item.material.name } : {})
	});

	function openEdit() {
		goto(resolve(`/lenses/${item.id}/edit`));
	}

	async function confirmDelete() {
		deleteLoading = true;
		try {
			await deleteLensCatalogItemById({ id: item.id });
			toast.success('Lente eliminado correctamente');
			goto(resolve('/lenses'));
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando lente'));
		} finally {
			deleteLoading = false;
			showDeleteModal = false;
		}
	}
</script>

<svelte:head>
	<title>{item.name} - Catálogo de Lentes - Optikt</title>
</svelte:head>

<div class="mx-auto max-w-7xl grid grid-cols-1 gap-4 p-4 pb-28 lg:grid-cols-12 lg:gap-6 lg:p-6 lg:pb-6">
	<!-- PRICING + HISTORY (mobile: first in DOM; desktop: right column, sticky) -->
	<section class="lg:col-span-4 lg:col-start-9 lg:row-start-1">
		<div class="flex flex-col gap-4 lg:sticky lg:top-14">
			<!-- Commercial pricing card -->
			<div class="relative overflow-hidden rounded-2xl bg-brand-navy px-5 py-5 text-white shadow-[var(--ds-shadow-lg)] sm:rounded-[1.75rem] sm:px-7 sm:py-6">
				<div class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"></div>
				<div class="relative">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-brand-gold uppercase sm:text-xs">
								Resumen comercial
							</p>
							<h2 class="font-heading mt-1.5 text-xl font-bold text-white sm:mt-2 sm:text-2xl">Costo y venta</h2>
						</div>
						{#if marginPercent != null}
							<span class="shrink-0 rounded-full bg-brand-gold px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase sm:px-3">
								{marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(0)}%
							</span>
						{/if}
					</div>

					<div class="mt-4 flex flex-col gap-3 text-sm text-white/78 sm:mt-6">
						<div class="flex items-center justify-between gap-4">
							<span>Costo base {getPriceTypeLabel(item.priceType).toLowerCase()}</span>
							<span class="font-mono font-semibold text-white">{formatPrice(item.basePrice)}</span>
						</div>
						<div class="flex items-center justify-between gap-4">
							<span>Costo por par</span>
							<span class="font-mono font-semibold text-white">{formatPrice(item.pairPurchasePrice)}</span>
						</div>
						{#if item.mountingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Montaje</span>
								<span class="font-mono font-semibold text-white">{formatPrice(item.mountingPrice)}</span>
							</div>
						{/if}
						{#if item.shippingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Envío</span>
								<span class="font-mono font-semibold text-white">{formatPrice(item.shippingPrice)}</span>
							</div>
						{/if}
					</div>

					<div class="mt-4 rounded-xl bg-white/10 px-4 py-4 sm:mt-6 sm:rounded-[1.25rem] sm:backdrop-blur-sm">
						<p class="text-[10px] font-semibold tracking-[0.14em] text-white/72 uppercase sm:text-xs">Precio de venta</p>
						{#if item.salePrice}
							<p class="mt-2 font-mono text-4xl font-bold tracking-tight text-white sm:mt-3 sm:text-4xl">
								{formatPrice(item.salePrice)}
							</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- History section -->
			<div class="rounded-2xl bg-surface-container-low px-5 py-5 shadow-[var(--ds-shadow-sm)] sm:rounded-[1.75rem] sm:px-7 sm:py-6">
				<div class="flex items-center gap-3 sm:items-start">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-brand-navy shadow-[var(--ds-shadow-sm)] sm:mt-1 sm:h-10 sm:w-10 sm:rounded-2xl">
						<History class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase sm:text-xs">Historial</p>
						<h2 class="font-heading mt-0.5 text-base font-bold text-brand-navy sm:mt-2 sm:text-2xl">Trazabilidad del registro</h2>
					</div>
				</div>

				<!-- Mobile: compact table-like rows -->
				<div class="mt-4 divide-y divide-[var(--color-surface-container-high)] sm:mt-5 sm:space-y-3 sm:divide-y-0">
					<div class="flex items-center justify-between gap-4 py-3 sm:rounded-[1.25rem] sm:bg-surface-container-lowest sm:px-4 sm:py-4 sm:shadow-[var(--ds-shadow-sm)]">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Creado</p>
							<p class="mt-1 text-sm font-medium text-brand-navy">
								{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
							</p>
						</div>
					</div>
					<div class="flex items-center justify-between gap-4 py-3 sm:rounded-[1.25rem] sm:bg-surface-container-lowest sm:px-4 sm:py-4 sm:shadow-[var(--ds-shadow-sm)]">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Última actualización</p>
							<p class="mt-1 text-sm font-medium text-brand-navy">
								{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
							</p>
						</div>
					</div>
					<div class="flex items-center justify-between gap-4 py-3 sm:rounded-[1.25rem] sm:bg-surface-container-lowest sm:px-4 sm:py-4 sm:shadow-[var(--ds-shadow-sm)]">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Registro</p>
							<p class="mt-1 font-mono text-xs leading-5 break-all text-on-surface-variant sm:leading-6">{item.id}</p>
						</div>
					</div>
				</div>

				<div class="mt-4 sm:mt-4">
					<button
						type="button"
						onclick={() => (showHistoryModal = true)}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-3.5 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark sm:py-3"
					>
						<History class="h-4 w-4" />
						Abrir historial completo
					</button>
				</div>
			</div>

			<!-- Desktop action buttons -->
			{#if isAdmin}
				<div class="hidden gap-3 lg:flex">
					<button
						type="button"
						onclick={() => (showDeleteModal = true)}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-error-container px-4 py-3 text-xs font-bold tracking-[0.18em] text-on-error-container uppercase transition-colors hover:brightness-[0.98]"
					>
						<Trash2 class="h-4 w-4" />
						Eliminar
					</button>
					<button
						type="button"
						onclick={openEdit}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-xs font-bold tracking-[0.18em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
					>
						<Pencil class="h-4 w-4" />
						Editar
					</button>
				</div>
			{/if}
		</div>
	</section>

	<!-- TECHNICAL INFO (mobile: second in DOM; desktop: left column) -->
	<div class="flex flex-col gap-4 lg:col-span-8 lg:col-start-1 lg:row-start-1 lg:gap-5">
		<PageHeader
			title={item.name}
			subtitle="Detalle de lente"
			backLabel="Volver al catálogo"
			backHref="/lenses"
		/>

		<!-- Tags row — larger touch targets on mobile -->
		<div class="flex flex-wrap items-center gap-2">
			<span class="inline-flex items-center gap-1.5 rounded-full bg-info-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-info-container uppercase sm:py-1.5 sm:text-[10px]">
				{getLensSourceLabel(item.source)}
			</span>
			<span class="inline-flex items-center gap-1.5 rounded-full bg-purple-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-purple-container uppercase sm:py-1.5 sm:text-[10px]">
				{getLensTypeLabel(item.type)}
			</span>
			<span class="inline-flex items-center gap-1.5 rounded-full bg-success-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-success-container uppercase sm:py-1.5 sm:text-[10px]">
				Activo
			</span>
			<span class="inline-flex items-center gap-1.5 rounded-full bg-warning-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-warning-container uppercase sm:py-1.5 sm:text-[10px]">
				{inventorySummary}
			</span>
		</div>

		<!-- Specs grid — single column on mobile, multi-column on larger screens -->
		<div class="rounded-2xl border border-[var(--color-surface-container-high)] bg-surface-container-lowest px-5 py-5 shadow-[var(--ds-shadow-md)] sm:rounded-[1.75rem] sm:px-7 sm:py-6">
			<div class="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5 md:grid-cols-3">
				{#if item.material}
					<div>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Material</p>
						<p class="mt-1 font-heading text-sm font-bold text-brand-navy sm:mt-1.5">{item.material.name}</p>
						<p class="mt-0.5 text-xs text-on-surface-variant">{item.material.code}</p>
					</div>
				{/if}

				{#if item.supplier}
					<div>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Proveedor</p>
						<p class="mt-1 font-heading text-sm font-bold text-brand-navy sm:mt-1.5">{item.supplier.name}</p>
					</div>
				{/if}

				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Índice de refracción</p>
					<p class="mt-1 font-mono text-sm font-bold tracking-tight text-brand-navy sm:mt-1.5">
						{refractiveIndexLabel ?? '—'}
					</p>
				</div>

				{#if item.technologyName}
					<div>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tecnología</p>
						<p class="mt-1 font-heading text-sm font-bold text-brand-navy sm:mt-1.5">{item.technologyName}</p>
					</div>
				{/if}

				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tipo de precio</p>
					<p class="mt-1 text-sm font-bold text-brand-navy sm:mt-1.5">{getPriceTypeLabel(item.priceType)}</p>
				</div>

				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">IVA</p>
					<p class="mt-1 text-sm font-bold text-brand-navy sm:mt-1.5">{getLensTaxSummary(item.isTaxable)}</p>
				</div>

				<div class="sm:col-span-2 md:col-span-1">
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Inventario</p>
					<p class="mt-1 font-heading text-sm font-bold text-brand-navy sm:mt-1.5">{inventorySummary}</p>
					<p class="mt-0.5 text-xs text-on-surface-variant">{getInventoryModeLabel(item.inventoryMode)}</p>
					{#if isAdmin && item.inventoryMode === 'STOCK'}
						<a
							href={resolve(`/lenses/${item.id}/adjustments`)}
							class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-[11px] font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy sm:py-1.5 sm:text-[10px]"
						>
							<ArrowRightLeft class="h-3.5 w-3.5 sm:h-3 sm:w-3" />
							Ajustar stock
						</a>
					{/if}
				</div>
			</div>

			<!-- Treatments inline -->
			{#if item.hasAr || item.hasBluecut || item.isPhotochromic}
				<div class="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--color-surface-container-high)] pt-5">
					<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase sm:text-xs">Tratamientos</p>
					{#if item.hasAr}
						<span class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container sm:py-1 sm:text-[11px]">AR</span>
					{/if}
					{#if item.hasBluecut}
						<span class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container sm:py-1 sm:text-[11px]">Bluecut</span>
					{/if}
					{#if item.isPhotochromic}
						<span class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container sm:py-1 sm:text-[11px]">Fotocromático</span>
					{/if}
				</div>
			{/if}

			<!-- Differentiators inline -->
			{#if item.differentiators && item.differentiators.length > 0}
				<div class="mt-4 flex flex-wrap items-center gap-2">
					<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase sm:text-xs">Etiquetas</p>
					{#each item.differentiators as tag (tag)}
						<span class="inline-flex items-center rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface sm:py-1">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Optical ranges + notes -->
		<LensDetailOpticalPanel {item} />
	</div>
</div>

<!-- Sticky bottom action bar (mobile only) -->
{#if isAdmin}
	<div class="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-surface-container-high)] bg-white px-4 pb-[env(safe-area-inset-bottom)] py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:relative lg:hidden">
		<div class="mx-auto flex max-w-lg items-center gap-3">
			<button
				type="button"
				onclick={() => (showDeleteModal = true)}
				class="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-error-container px-4 py-3 text-xs font-bold tracking-[0.18em] text-on-error-container uppercase transition-colors hover:brightness-[0.98]"
			>
				<Trash2 class="h-4 w-4" />
				Eliminar
			</button>
			<button
				type="button"
				onclick={openEdit}
				class="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-xs font-bold tracking-[0.18em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
			>
				<Pencil class="h-4 w-4" />
				Editar
			</button>
		</div>
	</div>
{/if}

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
