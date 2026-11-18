<script lang="ts">
	import { X } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import {
		SALE_DATE_PRESETS,
		SALE_DATE_PRESET_LABELS,
		SALE_LIST_SORT_OPTIONS,
		SALE_LIST_TOGGLES,
		type SaleDatePreset,
		type SaleListSort,
		type SaleListToggleKey
	} from './listParams';

	/**
	 * Hoja inferior de filtros (móvil): vendedor, fecha, «mostrar solo» y orden.
	 * Los cambios se aplican al instante (URL incluida, handlers del listado);
	 * «Ver N ventas» solo cierra — el conteo es el `total` que ya devuelve `listSales`.
	 * El estado de apertura vive en la página: cierre notificado vía `onclose`.
	 */
	interface Props {
		open: boolean;
		sellers: { id: string; fullName: string }[];
		sellerId: string;
		preset: SaleDatePreset;
		from: string | null;
		to: string | null;
		sort: SaleListSort;
		toggles: Record<SaleListToggleKey, boolean>;
		/** Nº total de filtros activos (para «Limpiar (n)»). */
		activeCount: number;
		/** Cargando la página actual: «Ver … ventas» mientras tanto. */
		loading: boolean;
		/** Ventas que cumplen los filtros (= total de la página actual). */
		resultCount: number;
		onSellerChange: (sellerId: string) => void;
		onPresetChange: (preset: SaleDatePreset) => void;
		onRangeChange: (from: string | null, to: string | null) => void;
		onToggle: (key: SaleListToggleKey) => void;
		onSortChange: (sort: SaleListSort) => void;
		onClear: () => void;
		onclose: () => void;
	}

	let {
		open,
		sellers,
		sellerId,
		preset,
		from,
		to,
		sort,
		toggles,
		activeCount,
		loading,
		resultCount,
		onSellerChange,
		onPresetChange,
		onRangeChange,
		onToggle,
		onSortChange,
		onClear,
		onclose
	}: Props = $props();

	const pillBase = 'h-10 rounded-full border px-3.5 text-[13px] font-semibold transition-colors';

	function pillClasses(active: boolean): string {
		return active
			? `${pillBase} border-brand-navy bg-brand-navy text-white`
			: `${pillBase} border-outline-variant bg-white text-on-surface hover:border-brand-blue`;
	}

	// El select nativo en móvil no aplica :active: cambiarlo aplica al instante.
	function handleSellerChange(e: Event): void {
		onSellerChange((e.currentTarget as HTMLSelectElement).value);
	}
</script>

<SlideOver {open} direction="bottom" dragClose closeOnVeil {onclose}>
	{#snippet header()}
		<div class="flex items-center justify-between px-1 pb-1">
			<p class="font-heading text-[18px] font-bold text-brand-navy">Filtros</p>
			<button
				type="button"
				onclick={onclose}
				aria-label="Cerrar filtros"
				class="grid h-10 w-10 place-items-center rounded-[var(--ds-radius-md)] text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="flex flex-col gap-1.5">
		<!-- Vendedor -->
		<p class="mt-1 text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
			Vendedor
		</p>
		<label class="sr-only" for="sales-mobile-seller">Vendedor</label>
		<select
			id="sales-mobile-seller"
			value={sellerId}
			onchange={handleSellerChange}
			class="h-11 w-full rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-2.5 text-sm font-medium text-on-surface focus:border-brand-blue focus:outline-none"
		>
			<option value="">Todos los vendedores</option>
			{#each sellers as seller (seller.id)}
				<option value={seller.id}>{seller.fullName}</option>
			{/each}
		</select>

		<!-- Fecha -->
		<p class="mt-2 text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
			Fecha
		</p>
		<div class="flex flex-wrap gap-2">
			{#each SALE_DATE_PRESETS as presetOption (presetOption)}
				<button
					type="button"
					aria-pressed={preset === presetOption}
					onclick={() => onPresetChange(presetOption)}
					class={pillClasses(preset === presetOption)}
				>
					{SALE_DATE_PRESET_LABELS[presetOption]}
				</button>
			{/each}
		</div>
		{#if preset === 'custom'}
			<div class="mt-1 flex items-center gap-2">
				<input
					type="date"
					aria-label="Desde"
					value={from ?? ''}
					onchange={(e) => onRangeChange(e.currentTarget.value || null, to)}
					class="h-11 flex-1 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-2.5 text-sm font-medium text-on-surface focus:border-brand-blue focus:outline-none"
				/>
				<input
					type="date"
					aria-label="Hasta"
					value={to ?? ''}
					onchange={(e) => onRangeChange(from, e.currentTarget.value || null)}
					class="h-11 flex-1 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-2.5 text-sm font-medium text-on-surface focus:border-brand-blue focus:outline-none"
				/>
			</div>
		{/if}

		<!-- Mostrar solo -->
		<p class="mt-2 text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
			Mostrar solo
		</p>
		{#each SALE_LIST_TOGGLES as toggle (toggle.key)}
			<button
				type="button"
				role="switch"
				aria-checked={toggles[toggle.key]}
				onclick={() => onToggle(toggle.key)}
				class="flex min-h-12 w-full items-center gap-2.5 rounded-[var(--ds-radius-md)] px-1 text-left text-[15px] font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
			>
				{toggle.label}
				<span
					class="ml-auto inline-flex h-[26px] w-11 items-center rounded-full p-0.5 transition-colors duration-200 {toggles[
						toggle.key
					]
						? 'bg-brand-blue'
						: 'bg-outline-variant'}"
				>
					<span
						class="h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out {toggles[
							toggle.key
						]
							? 'translate-x-[18px]'
							: ''}"
					></span>
				</span>
			</button>
		{/each}

		<!-- Ordenar por -->
		<p class="mt-2 text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
			Ordenar por
		</p>
		<div class="flex flex-wrap gap-2">
			{#each SALE_LIST_SORT_OPTIONS as sortOption (sortOption.value)}
				<button
					type="button"
					aria-pressed={sort === sortOption.value}
					onclick={() => onSortChange(sortOption.value)}
					class={pillClasses(sort === sortOption.value)}
				>
					{sortOption.label}
				</button>
			{/each}
		</div>
	</div>

	{#snippet footer()}
		<div class="flex gap-2.5 border-t border-outline-variant/50 px-4 pt-3 pb-1">
			<button
				type="button"
				onclick={() => {
					onClear();
				}}
				class="flex h-11 flex-1 items-center justify-center rounded-[var(--ds-radius-md)] border border-outline-variant bg-white text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
			>
				Limpiar {activeCount > 0 ? `(${activeCount})` : ''}
			</button>
			<button
				type="button"
				onclick={onclose}
				class="flex h-11 flex-[2] items-center justify-center rounded-[var(--ds-radius-md)] bg-brand-navy text-sm font-bold text-white transition-colors hover:bg-brand-navy-dark"
			>
				Ver {loading ? '…' : resultCount}
				{resultCount === 1 && !loading ? 'venta' : 'ventas'}
			</button>
		</div>
	{/snippet}
</SlideOver>
