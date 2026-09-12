<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import LensDetailOpticalPanel from '$lib/components/lenses/detail/LensDetailOpticalPanel.svelte';
	import LensDetailTags from '$lib/components/lenses/detail/LensDetailTags.svelte';
	import LensDetailSpecs from '$lib/components/lenses/detail/LensDetailSpecs.svelte';
	import LensDetailCostCard from '$lib/components/lenses/detail/LensDetailCostCard.svelte';
	import LensDetailHistory from '$lib/components/lenses/detail/LensDetailHistory.svelte';
	import LensDetailMobileChrome, {
		type LensDetailMobileTab
	} from '$lib/components/lenses/detail/LensDetailMobileChrome.svelte';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { isAdminRole } from '$lib/shared/enums';
	import { getErrorMessage, formatPrice, getBackUrl } from '$lib/utils';
	import {
		getLensMarginPercent,
		getLensTotalCost,
		getLensInventorySummary
	} from '$lib/components/lenses/detail/helpers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { item } = untrack(() => data);

	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let showHistoryModal = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	let mobileTab = $state<LensDetailMobileTab>('detalles');
	let showContextMenu = $state(false);

	const totalCost = $derived(
		getLensTotalCost(item.pairPurchasePrice, item.mountingPrice, item.shippingPrice)
	);
	const marginPercent = $derived(getLensMarginPercent(totalCost, item.salePrice));
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
		goto(resolve(getBackUrl('/lenses') as '/lenses'));
	}

	async function confirmDelete() {
		deleteLoading = true;
		try {
			await deleteLensCatalogItemById({ id: item.id });
			toast.success('Lente eliminado correctamente');
			goto(resolve('/lenses'));
		} catch (error) {
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

	function openHistoryModal() {
		showHistoryModal = true;
	}
</script>

<svelte:document onclick={handleContextMenuClick} />
<svelte:head>
	<title>{item.name} - Catálogo de Lentes - Optikt</title>
</svelte:head>

<!-- ─── MOBILE VIEW (< lg) ─────────────────────────────────────────────── -->
<div class="lg:hidden">
	<LensDetailMobileChrome
		itemName={item.name}
		{isAdmin}
		bind:mobileTab
		bind:showContextMenu
		onBack={goBack}
		onEdit={openEdit}
		onDelete={() => (showDeleteModal = true)}
	/>

	<LensDetailTags {item} variant="mobile" {inventorySummary} />

	<div class="space-y-4 px-4 pt-3 pb-24">
		{#if mobileTab === 'detalles'}
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
							Margen bruto {marginPercent.toFixed(0)}%
						</p>
					{/if}
				</div>
			{/if}

			<LensDetailSpecs
				{item}
				variant="mobile"
				{inventorySummary}
				{refractiveIndexLabel}
				{isAdmin}
			/>

			<LensDetailOpticalPanel {item} />
		{/if}

		{#if mobileTab === 'comercial'}
			<LensDetailCostCard {item} variant="mobile" {totalCost} {marginPercent} />
		{/if}

		{#if mobileTab === 'historial'}
			<LensDetailHistory {item} variant="mobile" onOpenHistory={openHistoryModal} />
		{/if}
	</div>
</div>

<!-- ─── DESKTOP VIEW (lg+) ─────────────────────────────────────────────── -->
<div
	class="mx-auto hidden max-w-7xl grid-cols-1 gap-4 p-4 pb-28 lg:grid lg:grid-cols-12 lg:gap-6 lg:p-6 lg:pb-6"
>
	<section class="lg:col-span-4 lg:col-start-9 lg:row-start-1">
		<div class="flex flex-col gap-4 lg:sticky lg:top-14">
			<LensDetailCostCard {item} variant="desktop" {totalCost} {marginPercent} />

			<LensDetailHistory {item} variant="desktop" onOpenHistory={openHistoryModal} />

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

	<div class="flex flex-col gap-y-4 lg:col-span-8 lg:col-start-1 lg:row-start-1">
		<PageHeader
			title={item.name}
			subtitle="Detalle de lente"
			backLabel="Volver al catálogo"
			backOnClick={goBack}
		/>

		<LensDetailTags {item} variant="desktop" {inventorySummary} />

		<LensDetailSpecs {item} variant="desktop" {inventorySummary} {refractiveIndexLabel} {isAdmin} />

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
