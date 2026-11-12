<script lang="ts">
	import { Search, SlidersHorizontal } from '@lucide/svelte';
	import PopoverRoot from '$lib/components/ui/popover/popover.svelte';
	import PopoverTrigger from '$lib/components/ui/popover/popover-trigger.svelte';
	import PopoverContent from '$lib/components/ui/popover/popover-content.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { SaleDatePreset, SaleListSort } from './listParams';

	type ToggleKey = 'cashea' | 'shippingPending' | 'freeItem' | 'balance';

	interface Props {
		search: string;
		sellerId: string;
		sellers: { id: string; fullName: string }[];
		preset: SaleDatePreset;
		from: string | null;
		to: string | null;
		sort: SaleListSort;
		toggles: Record<ToggleKey, boolean>;
		activeToggleCount: number;
		onSearch: (value: string) => void;
		onSellerChange: (sellerId: string) => void;
		onPresetChange: (preset: SaleDatePreset) => void;
		onRangeChange: (from: string | null, to: string | null) => void;
		onToggle: (key: ToggleKey) => void;
		onSortChange: (sort: SaleListSort) => void;
	}

	let {
		search,
		sellerId,
		sellers,
		preset,
		from,
		to,
		sort,
		toggles,
		activeToggleCount,
		onSearch,
		onSellerChange,
		onPresetChange,
		onRangeChange,
		onToggle,
		onSortChange
	}: Props = $props();

	let mobileOpen = $state(false);

	const control =
		'h-9 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-2.5 text-sm font-medium text-on-surface transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 focus:outline-none';

	const TOGGLES: { key: ToggleKey; label: string }[] = [
		{ key: 'cashea', label: 'Cashea' },
		{ key: 'shippingPending', label: 'Envío pendiente' },
		{ key: 'freeItem', label: 'Ítem libre' },
		{ key: 'balance', label: 'Solo con saldo pendiente' }
	];

	const PRESETS: { value: SaleDatePreset; label: string }[] = [
		{ value: 'all', label: 'Todas las fechas' },
		{ value: 'today', label: 'Hoy' },
		{ value: '7d', label: 'Últimos 7 días' },
		{ value: 'month', label: 'Este mes' },
		{ value: 'custom', label: 'Personalizado' }
	];

	const SORTS: { value: SaleListSort; label: string }[] = [
		{ value: 'recent', label: 'Más recientes' },
		{ value: 'balance', label: 'Mayor saldo' },
		{ value: 'total', label: 'Mayor total' },
		{ value: 'old', label: 'Más antiguas' }
	];

	const collapsedCount = $derived(
		(sellerId ? 1 : 0) + (preset !== 'all' ? 1 : 0) + activeToggleCount
	);

	/** Controles que en mobile viven en el bloque colapsable; en desktop van inline con la búsqueda. */
	const visBlock = $derived(mobileOpen ? 'block' : 'hidden');
	const visFlex = $derived(mobileOpen ? 'flex' : 'hidden');
	const visInline = $derived(mobileOpen ? 'inline-flex' : 'hidden');
</script>

<div class="flex flex-wrap items-center gap-2">
	<div class="relative min-w-[200px] flex-1 basis-52">
		<Search
			class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-outline"
		/>
		<input
			id="sales-search"
			name="sales-search"
			type="search"
			value={search}
			oninput={(e) => onSearch(e.currentTarget.value)}
			placeholder="Buscar por cliente, vendedor o # de orden…"
			aria-label="Buscar ventas"
			class="{control} w-full pl-9"
		/>
	</div>

	<button
		type="button"
		onclick={() => (mobileOpen = !mobileOpen)}
		aria-expanded={mobileOpen}
		aria-controls="sales-filter-controls"
		class="inline-flex h-9 items-center gap-1.5 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-3 text-sm font-semibold text-on-surface transition-colors lg:hidden {collapsedCount >
		0
			? 'border-brand-blue text-brand-blue'
			: ''}"
	>
		<SlidersHorizontal class="h-4 w-4" />
		Filtros
		{#if collapsedCount > 0}
			<span
				class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-navy px-1 text-[10px] font-bold text-white"
			>
				{collapsedCount}
			</span>
		{/if}
	</button>

	<div id="sales-filter-controls" class="contents">
		<label class="sr-only" for="sales-seller">Vendedor</label>
		<select
			id="sales-seller"
			class="{control} {visBlock} max-w-44 lg:block"
			value={sellerId}
			onchange={(e) => onSellerChange(e.currentTarget.value)}
		>
			<option value="">Todos los vendedores</option>
			{#each sellers as seller (seller.id)}
				<option value={seller.id}>{seller.fullName}</option>
			{/each}
		</select>

		<div class="{visFlex} items-center gap-1.5 lg:flex">
			<label class="sr-only" for="sales-date-preset">Fecha</label>
			<select
				id="sales-date-preset"
				class={control}
				value={preset}
				onchange={(e) => onPresetChange(e.currentTarget.value as SaleDatePreset)}
			>
				{#each PRESETS as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			{#if preset === 'custom'}
				<input
					type="date"
					aria-label="Desde"
					value={from ?? ''}
					onchange={(e) => onRangeChange(e.currentTarget.value || null, to)}
					class="{control} w-36"
				/>
				<input
					type="date"
					aria-label="Hasta"
					value={to ?? ''}
					onchange={(e) => onRangeChange(from, e.currentTarget.value || null)}
					class="{control} w-36"
				/>
			{/if}
		</div>

		<PopoverRoot>
			<PopoverTrigger
				aria-label="Más filtros"
				class="{visInline} h-9 items-center gap-1.5 rounded-[var(--ds-radius-md)] border px-3 text-sm font-semibold transition-colors lg:inline-flex {activeToggleCount >
				0
					? 'border-brand-blue bg-info-container text-on-info-container'
					: 'border-outline-variant bg-white text-on-surface'}"
			>
				<SlidersHorizontal class="h-4 w-4" />
				Filtros
				{#if activeToggleCount > 0}
					<span
						class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-navy px-1 text-[10px] font-bold text-white"
					>
						{activeToggleCount}
					</span>
				{/if}
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={6}
				class="w-64 gap-0 rounded-[var(--ds-radius-lg)] bg-white p-1.5 shadow-[var(--ds-shadow-lg)]"
			>
				{#each TOGGLES as toggle (toggle.key)}
					<button
						type="button"
						role="switch"
						aria-checked={toggles[toggle.key]}
						onclick={() => onToggle(toggle.key)}
						class="flex w-full items-center gap-2.5 rounded-[var(--ds-radius-md)] px-2.5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
					>
						{toggle.label}
						<span
							class="ml-auto inline-flex h-[18px] w-[30px] items-center rounded-full p-0.5 transition-colors duration-200 {toggles[
								toggle.key
							]
								? 'bg-brand-blue'
								: 'bg-outline-variant'}"
						>
							<span
								class="h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out {toggles[
									toggle.key
								]
									? 'translate-x-3'
									: ''}"
							></span>
						</span>
					</button>
				{/each}
			</PopoverContent>
		</PopoverRoot>

		<TriggerTooltip text="Orden de la lista" side="bottom">
			{#snippet trigger({ props })}
				<div {...props} class="{visBlock} lg:block">
					<label class="sr-only" for="sales-sort">Orden</label>
					<select
						id="sales-sort"
						class={control}
						value={sort}
						onchange={(e) => onSortChange(e.currentTarget.value as SaleListSort)}
					>
						{#each SORTS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}
		</TriggerTooltip>
	</div>
</div>
