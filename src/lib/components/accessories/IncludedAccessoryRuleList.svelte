<script lang="ts">
	import { untrack } from 'svelte';
	import { Package2, Paperclip, Trash2 } from '@lucide/svelte';
	import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
	import { formatPrice } from '$lib/utils';

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

	interface Props {
		rules: AccessoryRule[];
		emptyMessage: string;
		editable?: boolean;
		muted?: boolean;
		saving?: boolean;
		onDelete?: (ruleId: number) => void | Promise<void>;
		onSaveRule?: (
			ruleId: number,
			payload: {
				priceMode: BrandAccessoryPriceMode;
				customPrice: number | null;
			}
		) => void | Promise<void>;
	}

	let {
		rules,
		emptyMessage,
		editable = false,
		muted = false,
		saving = false,
		onDelete,
		onSaveRule
	}: Props = $props();

	let draftModes = $state<Record<number, BrandAccessoryPriceMode>>({});
	let draftCustomPrices = $state<Record<number, string>>({});

	const signature = $derived(
		rules
			.map(
				(rule) =>
					`${rule.id}:${rule.priceMode}:${rule.customPrice ?? ''}:${rule.currentProductPrice ?? ''}`
			)
			.join('|')
	);

	$effect(() => {
		void signature;
		untrack(() => {
			draftModes = Object.fromEntries(rules.map((rule) => [rule.id, rule.priceMode])) as Record<
				number,
				BrandAccessoryPriceMode
			>;
			draftCustomPrices = Object.fromEntries(
				rules.map((rule) => [rule.id, rule.customPrice != null ? String(rule.customPrice) : ''])
			) as Record<number, string>;
		});
	});

	function getPreviewLabel(rule: AccessoryRule): string {
		switch (rule.priceMode) {
			case BrandAccessoryPriceMode.PRODUCT:
				return 'Precio producto';
			case BrandAccessoryPriceMode.CUSTOM:
				return formatPrice(rule.customPrice ?? 0);
			case BrandAccessoryPriceMode.COURTESY:
			default:
				return 'Cortesía';
		}
	}

	function getPreviewClasses(rule: AccessoryRule): string {
		switch (rule.priceMode) {
			case BrandAccessoryPriceMode.PRODUCT:
				return 'bg-brand-blue/10 text-brand-blue';
			case BrandAccessoryPriceMode.CUSTOM:
				return 'bg-emerald-100 text-emerald-700';
			case BrandAccessoryPriceMode.COURTESY:
			default:
				return 'bg-surface-container-high text-on-surface-variant';
		}
	}

	function commitRule(rule: AccessoryRule) {
		if (!editable || !onSaveRule) return;

		const nextMode = draftModes[rule.id] ?? rule.priceMode;
		const parsedCustomPrice = Number(draftCustomPrices[rule.id] ?? rule.customPrice ?? '');
		const nextCustomPrice =
			nextMode === BrandAccessoryPriceMode.CUSTOM
				? Number.isFinite(parsedCustomPrice) && parsedCustomPrice > 0
					? parsedCustomPrice
					: null
				: null;

		if (nextMode === BrandAccessoryPriceMode.CUSTOM && nextCustomPrice == null) {
			draftCustomPrices[rule.id] = rule.customPrice != null ? String(rule.customPrice) : '';
			return;
		}

		if (nextMode === rule.priceMode && nextCustomPrice === (rule.customPrice ?? null)) {
			if (nextMode !== BrandAccessoryPriceMode.CUSTOM) {
				draftCustomPrices[rule.id] = '';
			}
			return;
		}

		void onSaveRule(rule.id, {
			priceMode: nextMode,
			customPrice: nextCustomPrice
		});
	}
</script>

{#if rules.length === 0}
	<div
		class="rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant"
	>
		{emptyMessage}
	</div>
{:else}
	<div class="space-y-3">
		{#each rules as rule (rule.id)}
			<div
				class="rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 {muted
					? 'opacity-70'
					: ''}"
			>
				<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div class="flex min-w-0 items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"
						>
							<Paperclip class="h-4 w-4" />
						</div>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<p class="truncate text-sm font-semibold text-brand-navy">{rule.accessory.name}</p>
								<span
									class="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-on-surface-variant uppercase"
								>
									<Package2 class="mr-1 inline h-3 w-3" />
									Accesorio
								</span>
								<span
									class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase {getPreviewClasses(
										rule
									)}"
								>
									{getPreviewLabel(rule)}
								</span>
							</div>
							<p class="mt-1 font-mono text-xs text-on-surface-variant">
								{rule.accessory.sku} · Stock {rule.accessory.stock}
							</p>
							{#if rule.priceMode === BrandAccessoryPriceMode.PRODUCT}
								<p class="mt-1 text-xs text-on-surface-variant">
									Precio actual del accesorio: {formatPrice(rule.currentProductPrice ?? 0)}
								</p>
							{/if}
						</div>
					</div>

					<div class="flex flex-wrap items-end gap-3 xl:justify-end">
						<div>
							<p class="mb-1 text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
								Modo de precio
							</p>
							{#if editable}
								<div class="space-y-2">
									<select
										bind:value={draftModes[rule.id]}
										onchange={() => {
											if (draftModes[rule.id] !== BrandAccessoryPriceMode.CUSTOM) {
												commitRule(rule);
											}
										}}
										disabled={saving}
										class="w-44 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-brand-navy focus:border-brand-blue/35 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
									>
										<option value={BrandAccessoryPriceMode.COURTESY}>Cortesía</option>
										<option value={BrandAccessoryPriceMode.PRODUCT}>Precio producto</option>
										<option value={BrandAccessoryPriceMode.CUSTOM}>Precio personalizado</option>
									</select>

									{#if draftModes[rule.id] === BrandAccessoryPriceMode.CUSTOM}
										<input
											type="number"
											min="0.01"
											step="0.01"
											bind:value={draftCustomPrices[rule.id]}
											onblur={() => commitRule(rule)}
											onkeydown={(event) => {
												if (event.key === 'Enter') {
													event.preventDefault();
													commitRule(rule);
												}
											}}
											disabled={saving}
											class="w-32 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-right font-mono text-sm text-brand-navy focus:border-brand-blue/35 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
										/>
									{/if}
								</div>
							{:else}
								<p class="text-sm font-semibold text-brand-navy">{getPreviewLabel(rule)}</p>
							{/if}
						</div>

						{#if editable && onDelete}
							<button
								type="button"
								onclick={() => void onDelete(rule.id)}
								disabled={saving}
								class="rounded-lg p-2 text-red-500 transition-colors hover:bg-error-container/60 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
								aria-label={`Eliminar ${rule.accessory.name}`}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
