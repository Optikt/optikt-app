<script lang="ts">
	import { Paperclip, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	import AddIncludedAccessoryDialog from '$lib/components/accessories/AddIncludedAccessoryDialog.svelte';
	import IncludedAccessoryRuleList from '$lib/components/accessories/IncludedAccessoryRuleList.svelte';
	import {
		deleteBrandAccessory,
		getBrandAccessories,
		upsertBrandAccessory
	} from '$lib/remote/brandAccessories.remote';
	import { listProducts } from '$lib/remote/products.remote';
	import type { Brand } from '$lib/server/db/schema';
	import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
	import { ProductType } from '$lib/shared/enums/productTypes';
	import { getErrorMessage } from '$lib/utils';

	interface AccessoryRule {
		id: number;
		priceMode: BrandAccessoryPriceMode;
		customPrice: number | null;
		currentProductPrice: number | null;
		accessory: {
			id: string;
			name: string;
			sku: string;
			stock: number;
			type: string;
		};
	}

	interface AccessoryOption {
		id: string;
		name: string;
	}

	interface Props {
		brand: Brand | null;
		canManage: boolean;
	}

	interface AccessoryPricePayload {
		priceMode: BrandAccessoryPriceMode;
		customPrice: number | null;
	}

	let { brand, canManage }: Props = $props();

	let rules = $state<AccessoryRule[]>([]);
	let accessoryOptions = $state<AccessoryOption[]>([]);
	let loading = $state(false);
	let loadingOptions = $state(false);
	let saving = $state(false);
	let loadError = $state<string | null>(null);
	let showAddDialog = $state(false);
	let requestId = 0;
	const ACCESSORY_OPTIONS_PAGE_SIZE = 100;

	async function loadRules({ imperative = false }: { imperative?: boolean } = {}) {
		if (!brand || !canManage) return;

		const currentRequestId = ++requestId;
		loading = true;
		loadError = null;

		try {
			const rulesQuery = getBrandAccessories({ brandId: brand.id });
			const nextRules = imperative ? await rulesQuery.run() : await rulesQuery;
			if (currentRequestId !== requestId) return;
			rules = nextRules as AccessoryRule[];
		} catch (error) {
			console.error(error);
			if (currentRequestId !== requestId) return;
			loadError = 'No se pudieron cargar los accesorios incluidos de esta marca.';
			toast.error(getErrorMessage(error, 'Error cargando accesorios incluidos'));
		} finally {
			if (currentRequestId === requestId) {
				loading = false;
			}
		}
	}

	async function ensureAccessoryOptions() {
		if (accessoryOptions.length > 0 || loadingOptions) return;

		loadingOptions = true;
		try {
			const nextOptions: AccessoryOption[] = [];
			let page = 1;
			let totalPages = 1;

			do {
				const result = await listProducts({
					page,
					perPage: ACCESSORY_OPTIONS_PAGE_SIZE,
					type: ProductType.ACCESSORY
				}).run();

				nextOptions.push(
					...result.items.map((product) => ({
						id: product.id,
						name: product.sku ? `${product.name} (${product.sku})` : product.name
					}))
				);

				totalPages = result.totalPages;
				page += 1;
			} while (page <= totalPages);

			accessoryOptions = nextOptions.sort((left, right) => left.name.localeCompare(right.name));
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando accesorios disponibles'));
		} finally {
			loadingOptions = false;
		}
	}

	async function openAddDialog() {
		if (!canManage) return;
		await ensureAccessoryOptions();
		showAddDialog = true;
	}

	async function handleAddAccessory(
		payload: { accessoryProductId: string } & AccessoryPricePayload
	) {
		if (!brand) return;

		saving = true;
		try {
			await upsertBrandAccessory({
				brandId: brand.id,
				accessoryProductId: payload.accessoryProductId,
				priceMode: payload.priceMode,
				customPrice: payload.customPrice
			});
			await loadRules({ imperative: true });
			showAddDialog = false;
			toast.success('Accesorio agregado a la marca');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error guardando accesorio incluido'));
		} finally {
			saving = false;
		}
	}

	async function handleDeleteAccessory(ruleId: number) {
		saving = true;
		try {
			await deleteBrandAccessory({ id: ruleId });
			await loadRules({ imperative: true });
			toast.success('Accesorio removido de la marca');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando accesorio incluido'));
		} finally {
			saving = false;
		}
	}

	async function handleSaveRule(ruleId: number, payload: AccessoryPricePayload) {
		const rule = rules.find((candidate) => candidate.id === ruleId);
		if (!brand || !rule) return;

		saving = true;
		try {
			await upsertBrandAccessory({
				id: rule.id,
				brandId: brand.id,
				accessoryProductId: rule.accessory.id,
				priceMode: payload.priceMode,
				customPrice: payload.customPrice
			});
			await loadRules({ imperative: true });
			toast.success('Configuración de precio actualizada');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error actualizando configuración de precio'));
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		const brandId = brand?.id;
		if (!brandId || !canManage) {
			rules = [];
			loadError = null;
			loading = false;
			showAddDialog = false;
			return;
		}

		void loadRules();
	});
</script>

<div class="border-t border-slate-200 pt-4">
	<div class="mb-4 flex items-start justify-between gap-3">
		<div>
			<h4 class="flex items-center gap-2 text-sm font-medium text-slate-600">
				<Paperclip class="h-4 w-4" />
				Accesorios Incluidos
			</h4>
			<p class="mt-1 text-sm leading-6 text-slate-500">
				Estos accesorios se agregan automáticamente al vender cualquier montura o lente de sol de
				esta marca, salvo que el producto tenga una configuración específica.
			</p>
		</div>
		{#if canManage}
			<button
				type="button"
				onclick={openAddDialog}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
			>
				<Plus class="h-4 w-4" />
				Agregar accesorio
			</button>
		{/if}
	</div>

	{#if loading}
		<p class="text-sm text-slate-500">Cargando accesorios incluidos...</p>
	{:else if loadError}
		<p class="text-sm text-red-600">{loadError}</p>
	{:else}
		<IncludedAccessoryRuleList
			{rules}
			emptyMessage="Esta marca todavía no tiene accesorios incluidos configurados."
			editable={canManage}
			{saving}
			onDelete={handleDeleteAccessory}
			onSaveRule={handleSaveRule}
		/>
	{/if}
</div>

<AddIncludedAccessoryDialog
	bind:open={showAddDialog}
	title="Agregar accesorio"
	description="Selecciona un producto del catálogo de accesorios y define si se incluirá de cortesía, con su precio de venta actual o con un precio personalizado."
	options={accessoryOptions}
	excludedIds={rules.map((rule) => rule.accessory.id)}
	saving={saving || loadingOptions}
	onCancel={() => {
		showAddDialog = false;
	}}
	onConfirm={handleAddAccessory}
/>
