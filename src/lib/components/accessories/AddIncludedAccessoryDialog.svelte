<script lang="ts">
	import { untrack } from 'svelte';
	import { Plus, X } from '@lucide/svelte';
	import { SelectInput } from '$lib/components/ui';

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
			defaultPrice: number;
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
	let defaultPrice = $state<number | string>(0);

	const availableOptions = $derived(options.filter((option) => !excludedIds.includes(option.id)));

	$effect(() => {
		if (!open) return;

		untrack(() => {
			selectedAccessoryId = '';
			defaultPrice = 0;
		});
	});

	function handleClose() {
		open = false;
		onCancel();
	}

	function handleConfirm() {
		const parsedPrice = Number(defaultPrice);
		if (!selectedAccessoryId || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
			return;
		}

		void onConfirm({ accessoryProductId: selectedAccessoryId, defaultPrice: parsedPrice });
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
					<label
						for="included-accessory-default-price"
						class="mb-2 block text-[10px] font-bold tracking-[0.18em] text-outline uppercase"
					>
						Precio por defecto
					</label>
					<input
						id="included-accessory-default-price"
						type="number"
						bind:value={defaultPrice}
						min="0"
						step="0.01"
						disabled={saving}
						class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-3 font-mono text-sm text-brand-navy focus:border-brand-blue/35 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<p class="mt-2 text-sm text-on-surface-variant">
						Precio 0 = el accesorio se entrega de cortesía incluido en la montura.
					</p>
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
					disabled={saving || !selectedAccessoryId || Number(defaultPrice) < 0}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Plus class="h-4 w-4" />
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
