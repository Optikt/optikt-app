<script lang="ts">
	import { Paperclip, Plus, RefreshCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	import AddIncludedAccessoryDialog from '$lib/components/accessories/AddIncludedAccessoryDialog.svelte';
	import IncludedAccessoryRuleList from '$lib/components/accessories/IncludedAccessoryRuleList.svelte';
	import {
		getBrandAccessories,
		getProductAccessoryOverride,
		upsertBrandAccessory,
		deleteBrandAccessory,
		toggleProductOverride
	} from '$lib/remote/brandAccessories.remote';
	import { listProducts } from '$lib/remote/products.remote';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { ProductType } from '$lib/shared/enums/productTypes';
	import { getErrorMessage } from '$lib/utils';

	interface AccessoryRule {
		id: number;
		defaultPrice: number;
		accessory: {
			id: string;
			name: string;
			sku: string;
			stock: number;
			type: string;
		};
	}

	interface ProductOverride {
		productId: string;
		brandId: string;
		isActive: boolean;
		accessories: AccessoryRule[];
	}

	interface AccessoryOption {
		id: string;
		name: string;
	}

	interface Props {
		product: ProductWithRelations;
		canManage: boolean;
		initialBrandAccessories: AccessoryRule[];
		initialProductOverride: ProductOverride | null;
	}

	let { product, canManage, initialBrandAccessories, initialProductOverride }: Props = $props();

	let brandAccessories = $state<AccessoryRule[]>([]);
	let productOverride = $state<ProductOverride | null>(null);
	let accessoryOptions = $state<AccessoryOption[]>([]);
	let loading = $state(false);
	let loadingOptions = $state(false);
	let saving = $state(false);
	let showAddDialog = $state(false);
	const ACCESSORY_OPTIONS_PAGE_SIZE = 100;

	$effect(() => {
		brandAccessories = initialBrandAccessories;
		productOverride = initialProductOverride;
	});

	const hasBrand = $derived(!!product.brand);
	const usingBrandConfig = $derived(productOverride === null);
	const overrideActive = $derived(productOverride?.isActive ?? false);
	const accessoriesEnabled = $derived(productOverride?.isActive ?? true);
	const displayedRules = $derived(
		usingBrandConfig ? brandAccessories : (productOverride?.accessories ?? [])
	);

	async function refreshState() {
		if (!product.brand) return;

		loading = true;
		try {
			const [nextBrandAccessories, nextOverride] = await Promise.all([
				getBrandAccessories({ brandId: product.brand.id }).run(),
				getProductAccessoryOverride({ id: product.id }).run()
			]);

			brandAccessories = nextBrandAccessories as AccessoryRule[];
			productOverride = nextOverride as ProductOverride | null;
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error recargando accesorios incluidos'));
		} finally {
			loading = false;
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
					...result.items.map((candidate) => ({
						id: candidate.id,
						name: candidate.sku ? `${candidate.name} (${candidate.sku})` : candidate.name
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

	async function handleStartCustomize() {
		if (!product.brand || !canManage) return;

		if (brandAccessories.length === 0) {
			await openAddDialog();
			return;
		}

		saving = true;
		try {
			await Promise.all(
				brandAccessories.map((rule) =>
					upsertBrandAccessory({
						brandId: product.brand!.id,
						productId: product.id,
						accessoryProductId: rule.accessory.id,
						defaultPrice: rule.defaultPrice
					})
				)
			);
			await refreshState();
			toast.success('Configuración personalizada creada para este producto');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error personalizando accesorios del producto'));
		} finally {
			saving = false;
		}
	}

	async function handleToggleAccessories(nextValue: boolean) {
		if (!product.brand || !canManage) return;

		saving = true;
		try {
			await toggleProductOverride({
				productId: product.id,
				brandId: product.brand.id,
				isActive: nextValue
			});
			await refreshState();
			toast.success(
				nextValue
					? 'Accesorios automáticos activados para este producto'
					: 'Accesorios automáticos desactivados para este producto'
			);
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error actualizando el estado de accesorios'));
		} finally {
			saving = false;
		}
	}

	async function handleAddAccessory(payload: { accessoryProductId: string; defaultPrice: number }) {
		if (!product.brand) return;

		saving = true;
		try {
			await upsertBrandAccessory({
				brandId: product.brand.id,
				productId: product.id,
				accessoryProductId: payload.accessoryProductId,
				defaultPrice: payload.defaultPrice
			});
			await refreshState();
			showAddDialog = false;
			toast.success('Accesorio agregado a la configuración del producto');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error guardando accesorio del producto'));
		} finally {
			saving = false;
		}
	}

	async function handleSavePrice(ruleId: number, defaultPrice: number) {
		if (!product.brand || !productOverride) return;

		const rule = productOverride.accessories.find((candidate) => candidate.id === ruleId);
		if (!rule) return;

		saving = true;
		try {
			await upsertBrandAccessory({
				id: rule.id,
				brandId: product.brand.id,
				productId: product.id,
				accessoryProductId: rule.accessory.id,
				defaultPrice
			});
			await refreshState();
			toast.success('Precio por defecto actualizado');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error actualizando precio por defecto'));
		} finally {
			saving = false;
		}
	}

	async function handleDeleteAccessory(ruleId: number) {
		saving = true;
		try {
			await deleteBrandAccessory({ id: ruleId });
			await refreshState();
			toast.success('Accesorio removido de la configuración del producto');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando accesorio del producto'));
		} finally {
			saving = false;
		}
	}

	async function handleResetToBrand() {
		if (!product.brand || !productOverride || !canManage) return;

		saving = true;
		try {
			if (productOverride.accessories.length > 0) {
				await Promise.all(
					productOverride.accessories.map((rule) => deleteBrandAccessory({ id: rule.id }))
				);
			}

			if (!productOverride.isActive && productOverride.accessories.length === 0) {
				await toggleProductOverride({
					productId: product.id,
					brandId: product.brand.id,
					isActive: true
				});
			}

			await refreshState();
			toast.success('El producto volvió a heredar la configuración de su marca');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error restableciendo la configuración del producto'));
		} finally {
			saving = false;
		}
	}
</script>

<section class="glass-card bg-surface-container-lowest p-8">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div>
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Producto</p>
			<h2
				class="font-heading mt-1 flex items-center gap-2 text-2xl font-bold tracking-[-0.02em] text-brand-navy"
			>
				<Paperclip class="h-5 w-5 text-brand-blue" />
				Accesorios Incluidos
			</h2>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
				Configura si este producto hereda los accesorios automáticos de la marca o usa una selección
				propia.
			</p>
		</div>

		{#if hasBrand && canManage}
			<button
				type="button"
				role="switch"
				aria-checked={accessoriesEnabled}
				onclick={() => void handleToggleAccessories(!accessoriesEnabled)}
				disabled={saving}
				class="inline-flex items-center gap-3 rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
			>
				<span>Incluir accesorios automáticos</span>
				<span
					class="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] uppercase {accessoriesEnabled
						? 'bg-emerald-100 text-emerald-700'
						: 'bg-slate-200 text-slate-600'}"
				>
					{accessoriesEnabled ? 'ON' : 'OFF'}
				</span>
			</button>
		{/if}
	</div>

	{#if !hasBrand}
		<div
			class="mt-6 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low px-5 py-5 text-sm text-on-surface-variant"
		>
			Asigna una marca al producto para poder heredar o personalizar accesorios incluidos.
		</div>
	{:else}
		<div class="mt-6 space-y-4">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div class="flex flex-wrap items-center gap-2">
					{#if usingBrandConfig}
						<span
							class="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue"
						>
							Usando configuración de la marca {product.brand?.name}
						</span>
					{:else if overrideActive}
						<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
							Configuración personalizada
						</span>
					{:else}
						<span class="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
							Accesorios automáticos desactivados
						</span>
					{/if}
				</div>

				{#if canManage}
					<div class="flex flex-wrap gap-2">
						{#if usingBrandConfig}
							<button
								type="button"
								onclick={() => void handleStartCustomize()}
								class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
							>
								<Plus class="h-4 w-4" />
								Personalizar para este producto
							</button>
						{:else if overrideActive}
							<button
								type="button"
								onclick={openAddDialog}
								class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark"
							>
								<Plus class="h-4 w-4" />
								Agregar accesorio
							</button>
							<button
								type="button"
								onclick={() => void handleResetToBrand()}
								class="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-low"
							>
								<RefreshCcw class="h-4 w-4" />
								Restablecer a configuración de marca
							</button>
						{/if}
					</div>
				{/if}
			</div>

			{#if loading}
				<p class="text-sm text-slate-500">Cargando accesorios del producto...</p>
			{:else if usingBrandConfig}
				<IncludedAccessoryRuleList
					rules={displayedRules}
					emptyMessage="La marca no tiene accesorios incluidos configurados para heredar."
				/>
			{:else if overrideActive}
				<IncludedAccessoryRuleList
					rules={displayedRules}
					emptyMessage="Esta configuración personalizada todavía no tiene accesorios."
					editable={canManage}
					{saving}
					onDelete={handleDeleteAccessory}
					onSavePrice={handleSavePrice}
				/>
			{:else}
				<div
					class="rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low px-5 py-5 text-sm text-on-surface-variant"
				>
					<p>Este producto no incluirá accesorios automáticos al venderse.</p>
					{#if (productOverride?.accessories.length ?? 0) > 0}
						<p class="mt-2">
							Al volver a activarlos se restaurará la configuración personalizada guardada.
						</p>
					{/if}
				</div>
				{#if (productOverride?.accessories.length ?? 0) > 0}
					<div class="mt-4">
						<IncludedAccessoryRuleList
							rules={productOverride?.accessories ?? []}
							emptyMessage=""
							muted={true}
						/>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</section>

<AddIncludedAccessoryDialog
	bind:open={showAddDialog}
	title="Agregar accesorio"
	description="Selecciona un accesorio del catálogo y define el precio inicial con el que este producto lo incluirá automáticamente."
	options={accessoryOptions}
	excludedIds={displayedRules.map((rule) => rule.accessory.id)}
	saving={saving || loadingOptions}
	onCancel={() => {
		showAddDialog = false;
	}}
	onConfirm={handleAddAccessory}
/>
