<script lang="ts">
	import { untrack } from 'svelte';
	import { Plus, X } from '@lucide/svelte';
	import { SelectInput } from '$lib/components/ui';
	import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';

	interface AccessoryOption {
		id: string;
		name: string;
	}

	interface Props {
		open: boolean;
		title: string;
		description: string;
		options: AccessoryOption[];
		excludedIds?: string[];
		saving?: boolean;
		confirmLabel?: string;
		onCancel: () => void;
		onConfirm: (payload: {
			accessoryProductId: string;
			priceMode: BrandAccessoryPriceMode;
			customPrice: number | null;
		}) => void | Promise<void>;
	}

	let {
		open = $bindable(),
		title,
		description,
		options,
		excludedIds = [],
		saving = false,
		confirmLabel = 'Agregar accesorio',
		onCancel,
		onConfirm
	}: Props = $props();

	let selectedAccessoryId = $state('');
	let selectedPriceMode = $state<BrandAccessoryPriceMode>(BrandAccessoryPriceMode.COURTESY);
	let customPrice = $state<number | string>('');

	const priceModeOptions: {
		value: BrandAccessoryPriceMode;
		label: string;
		description: string;
	}[] = [
		{
			value: BrandAccessoryPriceMode.COURTESY,
			label: 'Cortesía',
			description: 'El accesorio se agrega con precio 0.'
		},
		{
			value: BrandAccessoryPriceMode.PRODUCT,
			label: 'Precio producto',
			description: 'Usa el precio de venta actual del accesorio.'
		},
		{
			value: BrandAccessoryPriceMode.CUSTOM,
			label: 'Precio personalizado',
			description: 'Define un precio fijo para este accesorio incluido.'
		}
	];

	const availableOptions = $derived(options.filter((option) => !excludedIds.includes(option.id)));
	const requiresCustomPrice = $derived(selectedPriceMode === BrandAccessoryPriceMode.CUSTOM);

	$effect(() => {
		if (!open) return;

		untrack(() => {
			selectedAccessoryId = '';
			selectedPriceMode = BrandAccessoryPriceMode.COURTESY;
			customPrice = '';
		});
	});

	function handleClose() {
		open = false;
		onCancel();
	}

	function handleConfirm() {
		const parsedCustomPrice = Number(customPrice);
		if (!selectedAccessoryId) {
			return;
		}

		if (requiresCustomPrice && (!Number.isFinite(parsedCustomPrice) || parsedCustomPrice <= 0)) {
			return;
		}

		void onConfirm({
			accessoryProductId: selectedAccessoryId,
			priceMode: selectedPriceMode,
			customPrice: requiresCustomPrice ? parsedCustomPrice : null
		});
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
		role="presentation"
		onmousedown={(event) => {
			if (event.currentTarget === event.target) {
				handleClose();
			}
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			class="w-full max-w-xl rounded-[1.4rem] border border-outline-variant/20 bg-white p-6 shadow-2xl shadow-slate-900/15"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase">
						Configuración
					</p>
					<h3 class="mt-1 text-xl font-semibold text-brand-navy">{title}</h3>
					<p class="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
				</div>
				<button
					type="button"
					onclick={handleClose}
					class="rounded-lg p-2 text-outline transition-colors hover:bg-surface-container-low hover:text-brand-navy"
					aria-label="Cerrar"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="mt-6 space-y-5">
				<div>
					<label
						for="included-accessory-option"
						class="mb-2 block text-[10px] font-bold tracking-[0.18em] text-outline uppercase"
					>
						Accesorio
					</label>
					<SelectInput
						bind:value={selectedAccessoryId}
						options={availableOptions}
						inputId="included-accessory-option"
						placeholder={availableOptions.length === 0
							? 'No hay accesorios disponibles'
							: 'Buscar accesorio...'}
						disabled={saving || availableOptions.length === 0}
					/>
				</div>

				<div>
					<p class="mb-2 text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
						Modo de precio
					</p>
					<div class="grid gap-3 sm:grid-cols-3">
						{#each priceModeOptions as option (option.value)}
							<label
								class="flex cursor-pointer flex-col gap-2 rounded-xl border px-4 py-3 transition-colors {selectedPriceMode ===
								option.value
									? 'border-brand-blue/40 bg-brand-blue/5'
									: 'border-outline-variant/20 bg-surface-container-low'}"
							>
								<div class="flex items-center gap-2">
									<input
										type="radio"
										name="included-accessory-price-mode"
										value={option.value}
										bind:group={selectedPriceMode}
										disabled={saving}
										class="h-4 w-4 border-slate-300 text-brand-blue focus:ring-brand-blue"
									/>
									<span class="text-sm font-semibold text-brand-navy">{option.label}</span>
								</div>
								<p class="text-xs leading-5 text-on-surface-variant">{option.description}</p>
							</label>
						{/each}
					</div>

					{#if requiresCustomPrice}
						<div class="mt-4">
							<label
								for="included-accessory-custom-price"
								class="mb-2 block text-[10px] font-bold tracking-[0.18em] text-outline uppercase"
							>
								Precio personalizado
							</label>
							<input
								id="included-accessory-custom-price"
								type="number"
								bind:value={customPrice}
								min="0.01"
								step="0.01"
								disabled={saving}
								class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-3 font-mono text-sm text-brand-navy focus:border-brand-blue/35 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<p class="mt-2 text-sm text-on-surface-variant">
								Ingresa un precio mayor a 0 para este accesorio incluido.
							</p>
						</div>
					{:else if selectedPriceMode === BrandAccessoryPriceMode.PRODUCT}
						<p class="mt-4 text-sm text-on-surface-variant">
							Al agregarse en venta se tomará el precio de venta vigente del accesorio.
						</p>
					{:else}
						<p class="mt-4 text-sm text-on-surface-variant">
							Se agregará de cortesía junto con la montura o lente de sol.
						</p>
					{/if}
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={handleClose}
					class="rounded-lg border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-low"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					disabled={saving ||
						!selectedAccessoryId ||
						(requiresCustomPrice && Number(customPrice) <= 0)}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Plus class="h-4 w-4" />
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
