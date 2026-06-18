<script lang="ts">
	import { Pencil, Trash2, ArrowRightLeft, History, ArrowLeft, MoreVertical } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import LensDetailOpticalPanel from '$lib/components/lenses/detail/LensDetailOpticalPanel.svelte';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { isAdminRole } from '$lib/shared/enums';
	import {
		getPriceTypeLabel,
		getInventoryModeLabel,
		getLensSourceLabel,
		getLensTypeLabel
	} from '$lib/shared/enums/lensTypes';
	import { getErrorMessage, formatPrice, formatDate } from '$lib/utils';
	import {
		getLensMarginPercent,
		getLensInventorySummary,
		getLensTaxSummary
	} from '$lib/components/lenses/detail/helpers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { item } = untrack(() => data);

	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let showHistoryModal = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	let mobileTab = $state<'detalles' | 'comercial' | 'historial'>('detalles');
	let showContextMenu = $state(false);

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

	function goBack() {
		goto(resolve('/lenses'));
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
			showContextMenu = false;
		}
	}

	function handleContextMenuClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-context-menu]')) {
			showContextMenu = false;
		}
	}
</script>

<svelte:document onclick={handleContextMenuClick} />
<svelte:head>
	<title>{item.name} - Catálogo de Lentes - Optikt</title>
</svelte:head>

<!-- ─── MOBILE VIEW (< lg) ─────────────────────────────────────────────── -->
<div class="lg:hidden">
	<!-- Unified sticky header: title bar + tabs (anchored below navbar) -->
	<div class="sticky z-40 flex flex-col bg-white shadow-sm">
		<!-- Top App Bar -->
		<div
			class="flex items-center gap-3 border-b border-[var(--color-surface-container-high)] bg-white px-2 py-1"
		>
			<button
				type="button"
				onclick={goBack}
				class="flex h-10 w-10 items-center justify-center rounded-xl text-brand-navy transition-colors hover:bg-surface-container"
				aria-label="Volver al catálogo"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<h1 class="font-heading min-w-0 flex-1 truncate text-base font-bold text-brand-navy">
				{item.name}
			</h1>
			{#if isAdmin}
				<div class="relative" data-context-menu>
					<button
						type="button"
						onclick={() => (showContextMenu = !showContextMenu)}
						class="flex h-10 w-10 items-center justify-center rounded-xl text-brand-navy transition-colors hover:bg-surface-container"
						aria-label="Más opciones"
					>
						<MoreVertical class="h-5 w-5" />
					</button>
					{#if showContextMenu}
						<div
							class="absolute top-full right-0 z-50 mt-1 min-w-44 rounded-xl border border-[var(--color-surface-container-high)] bg-white py-1 shadow-lg"
						>
							<button
								type="button"
								onclick={() => {
									showContextMenu = false;
									openEdit();
								}}
								class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
							>
								<Pencil class="h-4 w-4" />
								Editar
							</button>
							<button
								type="button"
								onclick={() => (showDeleteModal = true)}
								class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-on-error-container transition-colors hover:bg-error-container"
							>
								<Trash2 class="h-4 w-4" />
								Eliminar
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Tab bar -->
		<div class="flex gap-0 border-b border-[var(--color-surface-container-high)] bg-white px-4">
			<button
				type="button"
				onclick={() => (mobileTab = 'detalles')}
				class="relative px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors"
				class:text-brand-navy={mobileTab === 'detalles'}
				class:text-outline={mobileTab !== 'detalles'}
			>
				Detalles
				{#if mobileTab === 'detalles'}
					<span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-navy"></span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => (mobileTab = 'comercial')}
				class="relative px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors"
				class:text-brand-navy={mobileTab === 'comercial'}
				class:text-outline={mobileTab !== 'comercial'}
			>
				Comercial
				{#if mobileTab === 'comercial'}
					<span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-gold"></span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => (mobileTab = 'historial')}
				class="relative px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors"
				class:text-brand-navy={mobileTab === 'historial'}
				class:text-outline={mobileTab !== 'historial'}
			>
				Historial
				{#if mobileTab === 'historial'}
					<span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-navy"></span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Tags row (below tabs, normal flow) -->
	<div class="scrollbar-none overflow-x-auto px-4 pt-3">
		<div class="flex items-center gap-2 whitespace-nowrap">
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-info-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-info-container uppercase"
			>
				{getLensSourceLabel(item.source)}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-purple-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-purple-container uppercase"
			>
				{getLensTypeLabel(item.type)}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold tracking-[0.12em] uppercase"
				class:bg-success-container={item.isActive}
				class:text-on-success-container={item.isActive}
				class:bg-surface-container-high={!item.isActive}
				class:text-outline={!item.isActive}
			>
				{item.isActive ? 'Activo' : 'Inactivo'}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-warning-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-warning-container uppercase"
			>
				{inventorySummary}
			</span>
		</div>
	</div>

	<!-- Tab content -->
	<div class="space-y-4 px-4 pt-3 pb-24">
		{#if mobileTab === 'detalles'}
			<!-- Sale price hero banner -->
			{#if item.salePrice}
				<div
					class="rounded-2xl bg-gradient-to-r from-brand-navy to-[var(--color-brand-navy-light)] p-4 text-white shadow-[var(--ds-shadow-md)]"
				>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-brand-gold uppercase">
						Precio de venta
					</p>
					<p class="mt-1 font-mono text-3xl font-bold tracking-tight text-white">
						{formatPrice(item.salePrice)}
					</p>
					{#if marginPercent != null}
						<p class="mt-1 text-sm text-white/72">
							Margen {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(0)}% sobre costo por par
						</p>
					{/if}
				</div>
			{/if}

			<!-- Specs grid -->
			<div
				class="rounded-2xl border border-[var(--color-surface-container-high)] bg-surface-container-lowest p-4 shadow-[var(--ds-shadow-md)]"
			>
				<div class="grid grid-cols-2 gap-x-3 gap-y-4">
					{#if item.material}
						<div>
							<p class="text-xs font-medium text-outline">Material</p>
							<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
								{item.material.name}
							</p>
							<p class="text-xs text-on-surface-variant">{item.material.code}</p>
						</div>
					{/if}
					{#if item.supplier}
						<div>
							<p class="text-xs font-medium text-outline">Proveedor</p>
							<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
								{item.supplier.name}
							</p>
						</div>
					{/if}
					<div>
						<p class="text-xs font-medium text-outline">Índice de refracción</p>
						<p class="mt-0.5 font-mono text-sm font-semibold tracking-tight text-brand-navy">
							{refractiveIndexLabel ?? '—'}
						</p>
					</div>
					{#if item.technologyName}
						<div>
							<p class="text-xs font-medium text-outline">Tecnología</p>
							<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
								{item.technologyName}
							</p>
						</div>
					{/if}
					<div>
						<p class="text-xs font-medium text-outline">Tipo de precio</p>
						<p class="mt-0.5 text-sm font-semibold text-brand-navy">
							{getPriceTypeLabel(item.priceType)}
						</p>
					</div>
					<div>
						<p class="text-xs font-medium text-outline">IVA</p>
						<p class="mt-0.5 text-sm font-semibold text-brand-navy">
							{getLensTaxSummary(item.isTaxable)}
						</p>
					</div>
					<div class="col-span-2">
						<p class="text-xs font-medium text-outline">Inventario</p>
						<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
							{inventorySummary}
						</p>
						<p class="text-xs text-on-surface-variant">
							{getInventoryModeLabel(item.inventoryMode)}
						</p>
						{#if isAdmin && item.inventoryMode === 'STOCK'}
							<a
								href={resolve(`/lenses/${item.id}/adjustments`)}
								class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-[11px] font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy"
							>
								<ArrowRightLeft class="h-3.5 w-3.5" />
								Ajustar stock
							</a>
						{/if}
					</div>
				</div>

				<!-- Treatments inline -->
				{#if item.hasAr || item.hasBluecut || item.isPhotochromic}
					<div
						class="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-surface-container-high)] pt-4"
					>
						<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Tratamientos
						</p>
						{#if item.hasAr}
							<span
								class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container"
								>AR</span
							>
						{/if}
						{#if item.hasBluecut}
							<span
								class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container"
								>Bluecut</span
							>
						{/if}
						{#if item.isPhotochromic}
							<span
								class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container"
								>Fotocromático</span
							>
						{/if}
					</div>
				{/if}

				<!-- Differentiators inline -->
				{#if item.differentiators && item.differentiators.some((t) => t.trim().length > 0)}
					<div class="mt-4 flex flex-wrap items-center gap-2">
						<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Etiquetas
						</p>
						{#each item.differentiators.filter((t) => t.trim().length > 0) as tag (tag)}
							<span
								class="inline-flex items-center rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface"
								>{tag}</span
							>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Optical ranges + notes -->
			<LensDetailOpticalPanel {item} />
		{/if}

		{#if mobileTab === 'comercial'}
			<!-- Cost breakdown card (no sale price — shown in Detalles tab) -->
			<div
				class="relative overflow-hidden rounded-2xl bg-brand-navy p-4 text-white shadow-[var(--ds-shadow-lg)]"
			>
				<div
					class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"
				></div>
				<div class="relative">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-brand-gold uppercase">
								Desglose de costos
							</p>
							<h2 class="font-heading mt-1.5 text-xl font-bold text-white">Costos internos</h2>
						</div>
						{#if marginPercent != null}
							<span
								class="shrink-0 rounded-full bg-brand-gold px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase"
							>
								Margen {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(0)}%
							</span>
						{/if}
					</div>

					<div class="mt-4 flex flex-col gap-3 text-sm text-white/78">
						<div class="flex items-center justify-between gap-4">
							<span>Costo base {getPriceTypeLabel(item.priceType).toLowerCase()}</span>
							<span class="font-mono font-semibold text-white">{formatPrice(item.basePrice)}</span>
						</div>
						<div class="flex items-center justify-between gap-4">
							<span>Costo por par</span>
							<span class="font-mono font-semibold text-white"
								>{formatPrice(item.pairPurchasePrice)}</span
							>
						</div>
						{#if item.mountingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Montaje</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.mountingPrice)}</span
								>
							</div>
						{/if}
						{#if item.shippingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Envío</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.shippingPrice)}</span
								>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if mobileTab === 'historial'}
			<!-- History section -->
			<div class="rounded-2xl bg-surface-container-low p-4 shadow-[var(--ds-shadow-sm)]">
				<div class="flex items-center gap-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-brand-navy shadow-[var(--ds-shadow-sm)]"
					>
						<History class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Historial
						</p>
						<h2 class="font-heading mt-0.5 text-base font-bold text-brand-navy">
							Trazabilidad del registro
						</h2>
					</div>
				</div>

				<div class="mt-4 divide-y divide-[var(--color-surface-container-high)]">
					<div class="flex items-center justify-between gap-4 py-3">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
								Creado
							</p>
							<p class="mt-1 text-sm font-medium text-brand-navy">
								{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
							</p>
						</div>
					</div>
					<div class="flex items-center justify-between gap-4 py-3">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
								Última actualización
							</p>
							<p class="mt-1 text-sm font-medium text-brand-navy">
								{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
							</p>
						</div>
					</div>
					<div class="flex items-center justify-between gap-4 py-3">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
								Registro
							</p>
							<p class="mt-1 font-mono text-xs leading-5 break-all text-on-surface-variant">
								{item.id}
							</p>
						</div>
					</div>
				</div>

				<div class="mt-4">
					<button
						type="button"
						onclick={() => (showHistoryModal = true)}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-3.5 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark"
					>
						<History class="h-4 w-4" />
						Abrir historial completo
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ─── DESKTOP VIEW (lg+) ─────────────────────────────────────────────── -->
<div
	class="mx-auto hidden max-w-7xl grid-cols-1 gap-4 p-4 pb-28 lg:grid lg:grid-cols-12 lg:gap-6 lg:p-6 lg:pb-6"
>
	<!-- PRICING + HISTORY (desktop: right column, sticky) -->
	<section class="lg:col-span-4 lg:col-start-9 lg:row-start-1">
		<div class="flex flex-col gap-4 lg:sticky lg:top-14">
			<!-- Commercial pricing card -->
			<div
				class="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-7 py-6 text-white shadow-[var(--ds-shadow-lg)]"
			>
				<div
					class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"
				></div>
				<div class="relative">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-semibold tracking-[0.16em] text-brand-gold uppercase">
								Resumen comercial
							</p>
							<h2 class="font-heading mt-2 text-2xl font-bold text-white">Costo y venta</h2>
						</div>
						{#if marginPercent != null}
							<span
								class="shrink-0 rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase"
							>
								{marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(0)}%
							</span>
						{/if}
					</div>

					<div class="mt-6 flex flex-col gap-3 text-sm text-white/78">
						<div class="flex items-center justify-between gap-4">
							<span>Costo base {getPriceTypeLabel(item.priceType).toLowerCase()}</span>
							<span class="font-mono font-semibold text-white">{formatPrice(item.basePrice)}</span>
						</div>
						<div class="flex items-center justify-between gap-4">
							<span>Costo por par</span>
							<span class="font-mono font-semibold text-white"
								>{formatPrice(item.pairPurchasePrice)}</span
							>
						</div>
						{#if item.mountingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Montaje</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.mountingPrice)}</span
								>
							</div>
						{/if}
						{#if item.shippingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Envío</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.shippingPrice)}</span
								>
							</div>
						{/if}
					</div>

					{#if item.salePrice}
						<div class="mt-6 rounded-[1.25rem] bg-white/10 px-4 py-4 backdrop-blur-sm">
							<p class="text-xs font-semibold tracking-[0.14em] text-white/72 uppercase">
								Precio de venta
							</p>
							<p class="mt-3 font-mono text-4xl font-bold tracking-tight text-white">
								{formatPrice(item.salePrice)}
							</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- History card -->
			<div
				class="rounded-[1.75rem] bg-surface-container-low px-7 py-6 shadow-[var(--ds-shadow-sm)]"
			>
				<div class="flex items-start gap-3">
					<div
						class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container-lowest text-brand-navy shadow-[var(--ds-shadow-sm)]"
					>
						<History class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-xs font-semibold tracking-[0.16em] text-outline uppercase">Historial</p>
						<h2 class="font-heading mt-2 text-2xl font-bold text-brand-navy">
							Trazabilidad del registro
						</h2>
					</div>
				</div>

				<div class="mt-5 space-y-3">
					<div
						class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-[var(--ds-shadow-sm)]"
					>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Creado</p>
						<p class="mt-2 text-sm font-medium text-brand-navy">
							{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
						</p>
					</div>
					<div
						class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-[var(--ds-shadow-sm)]"
					>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Última actualización
						</p>
						<p class="mt-2 text-sm font-medium text-brand-navy">
							{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
						</p>
					</div>
					<div
						class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-[var(--ds-shadow-sm)]"
					>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Registro
						</p>
						<p class="mt-2 font-mono text-xs leading-6 break-all text-on-surface-variant">
							{item.id}
						</p>
					</div>
				</div>

				<div class="mt-4">
					<button
						type="button"
						onclick={() => (showHistoryModal = true)}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-3 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark"
					>
						<History class="h-4 w-4" />
						Abrir historial completo
					</button>
				</div>
			</div>

			<!-- Desktop action buttons -->
			{#if isAdmin}
				<div class="flex gap-3">
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

	<!-- TECHNICAL INFO (desktop: left column) -->
	<div class="flex flex-col gap-y-4 lg:col-span-8 lg:col-start-1 lg:row-start-1">
		<PageHeader
			title={item.name}
			subtitle="Detalle de lente"
			backLabel="Volver al catálogo"
			backHref="/lenses"
		/>

		<!-- Tags row -->
		<div class="-mt-4 flex flex-wrap items-center gap-2">
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-info-container px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-on-info-container uppercase"
			>
				{getLensSourceLabel(item.source)}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-purple-container px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-on-purple-container uppercase"
			>
				{getLensTypeLabel(item.type)}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] uppercase"
				class:bg-success-container={item.isActive}
				class:text-on-success-container={item.isActive}
				class:bg-surface-container-high={!item.isActive}
				class:text-outline={!item.isActive}
			>
				{item.isActive ? 'Activo' : 'Inactivo'}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-warning-container px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-on-warning-container uppercase"
			>
				{inventorySummary}
			</span>
		</div>

		<!-- Specs grid card -->
		<div
			class="rounded-[1.75rem] border border-[var(--color-surface-container-high)] bg-surface-container-lowest px-7 py-6 shadow-[var(--ds-shadow-md)]"
		>
			<div class="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
				{#if item.material}
					<div>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Material
						</p>
						<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">
							{item.material.name}
						</p>
						<p class="mt-0.5 text-xs text-on-surface-variant">{item.material.code}</p>
					</div>
				{/if}
				{#if item.supplier}
					<div>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Proveedor
						</p>
						<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">
							{item.supplier.name}
						</p>
					</div>
				{/if}
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Índice de refracción
					</p>
					<p class="mt-1.5 font-mono text-sm font-bold tracking-tight text-brand-navy">
						{refractiveIndexLabel ?? '—'}
					</p>
				</div>
				{#if item.technologyName}
					<div>
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Tecnología
						</p>
						<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">
							{item.technologyName}
						</p>
					</div>
				{/if}
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Tipo de precio
					</p>
					<p class="mt-1.5 text-sm font-bold text-brand-navy">
						{getPriceTypeLabel(item.priceType)}
					</p>
				</div>
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">IVA</p>
					<p class="mt-1.5 text-sm font-bold text-brand-navy">
						{getLensTaxSummary(item.isTaxable)}
					</p>
				</div>
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Inventario
					</p>
					<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">{inventorySummary}</p>
					<p class="mt-0.5 text-xs text-on-surface-variant">
						{getInventoryModeLabel(item.inventoryMode)}
					</p>
					{#if isAdmin && item.inventoryMode === 'STOCK'}
						<a
							href={resolve(`/lenses/${item.id}/adjustments`)}
							class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy"
						>
							<ArrowRightLeft class="h-3 w-3" />
							Ajustar stock
						</a>
					{/if}
				</div>
			</div>

			<!-- Treatments inline -->
			{#if item.hasAr || item.hasBluecut || item.isPhotochromic}
				<div
					class="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--color-surface-container-high)] pt-5"
				>
					<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Tratamientos
					</p>
					{#if item.hasAr}
						<span
							class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1 text-[11px] font-bold text-on-info-container"
							>AR</span
						>
					{/if}
					{#if item.hasBluecut}
						<span
							class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1 text-[11px] font-bold text-on-info-container"
							>Bluecut</span
						>
					{/if}
					{#if item.isPhotochromic}
						<span
							class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1 text-[11px] font-bold text-on-info-container"
							>Fotocromático</span
						>
					{/if}
				</div>
			{/if}

			<!-- Differentiators inline -->
			{#if item.differentiators && item.differentiators.some((t) => t.trim().length > 0)}
				<div class="mt-4 flex flex-wrap items-center gap-2">
					<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Etiquetas
					</p>
					{#each item.differentiators.filter((t) => t.trim().length > 0) as tag (tag)}
						<span
							class="inline-flex items-center rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface"
							>{tag}</span
						>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Optical ranges + notes -->
		<LensDetailOpticalPanel {item} />
	</div>
</div>

<!-- ─── MODALS ─────────────────────────────────────────────────────────── -->
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

<ChangeHistoryModal
	bind:open={showHistoryModal}
	title={item.name}
	entityType="lens_catalog_item"
	entityId={item.id}
	{relatedNames}
/>

<!-- ─── GLOBAL STYLES (mobile only) ───────────────────────────────────── -->
<style>
	@media (max-width: 1023px) {
		:global(.hamburger-nav-toggle) ~ *,
		:global([aria-label='Abrir menú de navegación']),
		:global([aria-label='Cerrar menú de navegación']) {
			display: none !important;
		}
	}
</style>
