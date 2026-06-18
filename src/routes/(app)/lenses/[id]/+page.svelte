<script lang="ts">
	import {
		Pencil,
		Trash2,
		ArrowRightLeft,
		History,
		Package
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import LensDetailHeroCard from '$lib/components/lenses/detail/LensDetailHeroCard.svelte';
	import LensDetailOpticalPanel from '$lib/components/lenses/detail/LensDetailOpticalPanel.svelte';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { isAdminRole } from '$lib/shared/enums';
	import { getPriceTypeLabel, getInventoryModeLabel } from '$lib/shared/enums/lensTypes';
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
		item.material?.refractiveIndex != null ? item.material.refractiveIndex.toFixed(2) : 'Sin índice'
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

<!-- Main content with padding for sticky bar on mobile -->
<div class="space-y-5 p-4 pb-24 sm:p-6 sm:pb-6">
	<PageHeader
		title={item.name}
		subtitle="Detalle de lente"
		backLabel="Volver al catálogo"
		backHref="/lenses"
	>
		{#snippet actions()}
			{#if isAdmin}
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => (showDeleteModal = true)}
						class="inline-flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-xs font-bold tracking-[0.18em] text-on-error-container uppercase transition-colors hover:brightness-[0.98]"
					>
						<Trash2 class="h-4 w-4" />
						<span class="hidden sm:inline">Eliminar</span>
					</button>
					<button
						type="button"
						onclick={openEdit}
						class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-xs font-bold tracking-[0.18em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
					>
						<Pencil class="h-4 w-4" />
						<span class="hidden sm:inline">Editar lente</span>
					</button>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- HERO OVERVIEW: badges + key specs + treatments + differentiators -->
	<LensDetailHeroCard {item} />

	<!-- COMMERCIAL PRICING HERO -->
	<section class="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-6 py-6 text-white shadow-[0_18px_44px_rgba(21,35,70,0.18)] sm:px-7">
		<div class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"></div>
		<div class="relative">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold tracking-[0.16em] text-brand-gold uppercase">
						Resumen comercial
					</p>
					<h2 class="font-heading mt-2 text-2xl font-bold text-white">Costo y venta</h2>
				</div>
				{#if marginPercent != null}
					<span class="shrink-0 rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase">
						Margen {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(0)}%
					</span>
				{/if}
			</div>

			<div class="mt-6 space-y-3 text-sm text-white/78">
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

			<div class="mt-6 rounded-[1.25rem] bg-white/10 px-4 py-4 backdrop-blur-sm">
				<p class="text-xs font-semibold tracking-[0.14em] text-white/72 uppercase">Precio de venta</p>
				{#if item.salePrice}
					<p class="mt-3 font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl">
						{formatPrice(item.salePrice)}
					</p>
				{:else}
					<p class="mt-3 text-sm font-medium text-white/72">Sin precio cargado</p>
				{/if}
			</div>
		</div>
	</section>

	<!-- OPERATION DETAILS: compact grid -->
	<section class="rounded-[1.75rem] bg-surface-container-lowest px-6 py-6 shadow-sm sm:px-7">
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
				<div class="flex items-center gap-2 text-brand-navy">
					<Package class="h-4 w-4 shrink-0" />
					<p class="text-[10px] font-semibold tracking-[0.16em] uppercase">Inventario</p>
				</div>
				<p class="mt-2 text-base font-semibold text-brand-navy">{inventorySummary}</p>
				<p class="mt-0.5 text-xs text-on-surface-variant">{getInventoryModeLabel(item.inventoryMode)}</p>
				{#if isAdmin && item.inventoryMode === 'STOCK'}
					<a
						href={resolve(`/lenses/${item.id}/adjustments`)}
						class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy"
					>
						<ArrowRightLeft class="h-3 w-3" />
						Ajustar
					</a>
				{/if}
			</div>
			<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tipo de precio</p>
				<p class="mt-2 text-base font-semibold text-brand-navy">{getPriceTypeLabel(item.priceType)}</p>
			</div>
			<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Índice de refracción
				</p>
				<p class="mt-2 font-mono text-base font-bold tracking-tight text-brand-navy">
					{refractiveIndexLabel}
				</p>
				<p class="mt-0.5 text-xs text-on-surface-variant">{item.material?.code ?? '-'}</p>
			</div>
			<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">IVA</p>
				<p class="mt-2 text-base font-semibold text-brand-navy">{getLensTaxSummary(item.isTaxable)}</p>
			</div>
		</div>
	</section>

	<!-- OPTICAL RANGES + NOTES -->
	<LensDetailOpticalPanel {item} />

	<!-- HISTORY FOOTER -->
	<section class="rounded-[1.75rem] bg-surface-container-low px-6 py-6 shadow-sm sm:px-7">
		<div class="flex items-start gap-3">
			<div class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container-lowest text-brand-navy shadow-sm">
				<History class="h-4 w-4" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-semibold tracking-[0.16em] text-outline uppercase">Historial</p>
				<h2 class="font-heading mt-2 text-2xl font-bold text-brand-navy">Trazabilidad del registro</h2>
			</div>
		</div>

		<div class="mt-5 grid gap-3 sm:grid-cols-3">
			<div class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-sm">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Creado</p>
				<p class="mt-2 text-sm font-medium text-brand-navy">
					{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
			<div class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-sm">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Última actualización</p>
				<p class="mt-2 text-sm font-medium text-brand-navy">
					{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
			<div class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-sm">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Registro</p>
				<p class="mt-2 font-mono text-xs leading-6 break-all text-on-surface-variant">{item.id}</p>
			</div>
		</div>

		<div class="mt-4 flex justify-end">
			<button
				type="button"
				onclick={() => (showHistoryModal = true)}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-3 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark"
			>
				<History class="h-4 w-4" />
				Abrir historial completo
			</button>
		</div>
	</section>
</div>

<!-- STICKY BOTTOM ACTION BAR (mobile only) -->
{#if isAdmin}
	<div class="fixed inset-x-0 bottom-0 z-40 border-t border-surface-container-high bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:relative sm:hidden">
		<div class="mx-auto flex max-w-lg items-center gap-3">
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
