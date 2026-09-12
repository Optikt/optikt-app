<script lang="ts">
	import { fromISO, toRelative, toRelativeShort } from '$lib/dates';
	import type { ExchangeRateEntry } from '$lib/shared/exchangeRates';
	import {
		buttonLabel,
		formatValue,
		getRateStyle,
		type ConversionResult
	} from './currencyCalcUtils';

	interface Props {
		allRates: ExchangeRateEntry[];
		conversions: ConversionResult[];
		isCustomStale: boolean;
		onDismissStale: () => void;
	}

	let { allRates, conversions, isCustomStale, onDismissStale }: Props = $props();
</script>

<div class="flex-1 overflow-y-auto">
	<div class="divide-y divide-slate-100 border-t border-slate-100 pb-1">
		{#if allRates.length === 0}
			<p class="px-5 py-6 text-center text-sm text-slate-400">Tasas no disponibles</p>
		{:else}
			{#each conversions as conv (conv.rate.sourceKey)}
				{@const style = conv.code === 'Bs' ? null : getRateStyle(conv.rate.sourceKey)}
				{@const isCustom = conv.rate.sourceKey === '__custom__'}
				<div
					class="flex items-center gap-2 px-3 py-2 {isCustom
						? 'rounded-lg border-l-2 pl-3.5 ' +
							(isCustomStale ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200')
						: ''}"
					title={isCustom && isCustomStale
						? 'Guardada hace más de 6 horas. Puede estar desactualizada.'
						: ''}
				>
					{#if conv.code === 'Bs'}
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/20"
						>
							<span class="text-xs font-bold text-amber-600">Bs</span>
						</div>
					{:else if style?.svgSrc}
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {style.bg}">
							<img src={style.svgSrc} alt={conv.code} class="h-3.5 w-3.5" />
						</div>
					{:else if style?.icon}
						{@const Icon = style.icon}
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {style.bg}">
							<Icon size={14} class={style.iconClass} />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold text-brand-navy">{conv.label}</p>
						{#if conv.code !== 'Bs'}
							<p
								class="text-[11px] text-slate-400"
								title={isCustom
									? 'Tasa personalizada guardada en el navegador'
									: 'Proveedor actualizó ' + toRelative(fromISO(conv.rate.lastUpdated))}
							>
								{isCustom ? 'Tasa personalizada' : toRelativeShort(fromISO(conv.rate.lastUpdated))}
							</p>
						{/if}
					</div>

					<div class="flex items-center gap-1.5 text-right">
						{#if isCustom && isCustomStale}
							<button
								type="button"
								class="flex h-6 w-6 items-center justify-center rounded text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600"
								onclick={onDismissStale}
								title="Reiniciar contador de 6h"
								aria-label="Descartar aviso de actualización"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									class="h-3.5 w-3.5"
									><path d="M20 12a8 8 0 1 1-8-8" /><path d="M12 2v4l3-3-3-3" /></svg
								>
							</button>
						{/if}
						<div>
							<span
								class="font-mono text-lg font-bold tabular-nums {conv.value === 0
									? 'text-slate-300'
									: 'text-brand-navy'}"
							>
								{formatValue(conv.value)}
							</span>
							<span class="ml-1 text-[11px] text-slate-400">{conv.code}</span>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	{#if allRates.length > 0}
		<div class="border-t border-slate-100 px-4 py-2.5">
			<p class="mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
				Tasas actuales
			</p>
			<div class="grid grid-cols-3 gap-1.5">
				{#each allRates as rate (rate.sourceKey)}
					{@const style = getRateStyle(rate.sourceKey)}
					<div class="flex flex-col items-center gap-0.5 rounded-xl bg-slate-50 px-1.5 py-1.5">
						<div class="flex h-6 w-6 items-center justify-center rounded-full {style.bg}">
							{#if style.svgSrc}
								<img src={style.svgSrc} alt={buttonLabel(rate.sourceKey)} class="h-3 w-3" />
							{:else if style.icon}
								{@const Icon = style.icon}
								<Icon size={11} class={style.iconClass} />
							{/if}
						</div>
						<span class="text-[10px] font-medium text-slate-500">{buttonLabel(rate.sourceKey)}</span
						>
						<span class="font-mono text-xs font-bold text-brand-navy tabular-nums">
							{rate.value.toFixed(2)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
