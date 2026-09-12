<script lang="ts">
	import { formatPrice } from '$lib/utils';

	interface Props {
		total: number;
		activeCount: number;
		visibleCount: number;
		includeVoided: boolean;
		selectedCategoryLabel: string;
		dateFrom: string;
		dateTo: string;
	}

	let {
		total,
		activeCount,
		visibleCount,
		includeVoided,
		selectedCategoryLabel,
		dateFrom,
		dateTo
	}: Props = $props();

	const mobileLabelClass = 'text-[10px] font-semibold tracking-[0.18em] text-outline uppercase';
	const mobileMetaClass = 'mt-1 text-[11px] text-on-surface-variant';
	const mobileInsetClass = 'rounded-xl bg-surface-container-low px-3 py-3';
	const desktopLabelClass = 'text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase';
	const desktopValueClass = 'mt-2 font-mono text-[1.6rem] font-semibold leading-none tabular-nums';
</script>

<div class="mb-5 grid grid-cols-2 gap-2 lg:hidden">
	<div class={`${mobileInsetClass}`}>
		<p class={mobileLabelClass}>Total activo USD</p>
		<p class="mt-1 font-mono text-[17px] font-semibold text-rose-700 tabular-nums">
			{formatPrice(total)}
		</p>
		<p class={mobileMetaClass}>Solo egresos no anulados</p>
	</div>
	<div class={`${mobileInsetClass}`}>
		<p class={mobileLabelClass}>Cantidad activa</p>
		<p class="mt-1 font-mono text-[17px] font-semibold text-brand-navy tabular-nums">
			{activeCount}
		</p>
		<p class={mobileMetaClass}>
			{includeVoided ? `${visibleCount} visibles` : 'Vista limpia de activos'}
		</p>
	</div>
</div>

<div class="mb-6 hidden lg:block">
	<div class="glass-card overflow-hidden">
		<div class="grid items-stretch gap-px bg-slate-200 lg:grid-cols-[15rem_13rem_minmax(0,1fr)]">
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Total activo USD</p>
				<p class={`${desktopValueClass} text-rose-700`}>{formatPrice(total)}</p>
				<p class="mt-2 text-xs text-slate-500">Solo egresos no anulados</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Cantidad activa</p>
				<p class={`${desktopValueClass} text-brand-navy`}>{activeCount}</p>
				<p class="mt-2 text-xs text-slate-500">
					{includeVoided ? `${visibleCount} visibles` : 'Vista limpia de activos'}
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Categoría activa</p>
				<p class="mt-2 text-base font-semibold text-brand-navy">{selectedCategoryLabel}</p>
				<p class="mt-2 text-xs text-slate-500">{dateFrom} a {dateTo}</p>
			</div>
		</div>
	</div>
</div>
