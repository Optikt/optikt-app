<script lang="ts">
	import { untrack } from 'svelte';
	import { Package2, Paperclip, Trash2 } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';

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

	interface Props {
		rules: AccessoryRule[];
		emptyMessage: string;
		editable?: boolean;
		muted?: boolean;
		saving?: boolean;
		onDelete?: (ruleId: number) => void | Promise<void>;
		onSavePrice?: (ruleId: number, defaultPrice: number) => void | Promise<void>;
	}

	let {
		rules,
		emptyMessage,
		editable = false,
		muted = false,
		saving = false,
		onDelete,
		onSavePrice
	}: Props = $props();

	let draftPrices = $state<Record<number, string>>({});

	const signature = $derived(rules.map((rule) => `${rule.id}:${rule.defaultPrice}`).join('|'));

	$effect(() => {
		void signature;
		untrack(() => {
			draftPrices = Object.fromEntries(
				rules.map((rule) => [rule.id, String(rule.defaultPrice)])
			) as Record<number, string>;
		});
	});

	function commitPrice(rule: AccessoryRule) {
		if (!editable || !onSavePrice) return;

		const nextValue = Number(draftPrices[rule.id] ?? rule.defaultPrice);
		if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue === rule.defaultPrice) {
			draftPrices[rule.id] = String(rule.defaultPrice);
			return;
		}

		void onSavePrice(rule.id, nextValue);
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
							</div>
							<p class="mt-1 font-mono text-xs text-on-surface-variant">
								{rule.accessory.sku} · Stock {rule.accessory.stock}
							</p>
						</div>
					</div>

					<div class="flex flex-wrap items-end gap-3 xl:justify-end">
						<div>
							<p class="mb-1 text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
								Precio por defecto
							</p>
							{#if editable}
								<input
									type="number"
									min="0"
									step="0.01"
									bind:value={draftPrices[rule.id]}
									onblur={() => commitPrice(rule)}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											event.preventDefault();
											commitPrice(rule);
										}
									}}
									disabled={saving}
									class="w-28 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-right font-mono text-sm text-brand-navy focus:border-brand-blue/35 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
								/>
							{:else}
								<p class="font-mono text-sm font-semibold text-brand-navy">
									{formatPrice(rule.defaultPrice)}
								</p>
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
