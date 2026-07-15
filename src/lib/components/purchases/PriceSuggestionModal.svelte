<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ArrowRight, Check } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import type { PriceSuggestion } from '$lib/remote/purchaseOrders.remote';

	interface Props {
		open: boolean;
		suggestions: PriceSuggestion[];
		loading?: boolean;
		onApply: (updates: { productId: string; newSalePrice: number }[]) => void;
		onSkip: () => void;
	}

	let { open = $bindable(), suggestions, loading = false, onApply, onSkip }: Props = $props();

	let selected = $state<Record<string, boolean>>({});

	$effect(() => {
		if (open && suggestions.length > 0) {
			const init: Record<string, boolean> = {};
			for (const s of suggestions) {
				init[s.productId] = true;
			}
			selected = init;
		}
	});

	let selectedCount = $derived(Object.values(selected).filter(Boolean).length);

	function toggleAll(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		const next: Record<string, boolean> = {};
		for (const s of suggestions) {
			next[s.productId] = checked;
		}
		selected = next;
	}

	function toggleOne(productId: string, e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		selected = { ...selected, [productId]: checked };
	}

	let allSelected = $derived(suggestions.length > 0 && selectedCount === suggestions.length);

	function handleApply() {
		const updates = suggestions
			.filter((s) => selected[s.productId])
			.map((s) => ({ productId: s.productId, newSalePrice: s.suggestedSalePrice }));
		if (updates.length > 0) {
			onApply(updates);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Sugerencias de Precio</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<p class="text-sm text-slate-600">
				Los siguientes productos tienen un precio de venta diferente al registrado en la orden de
				compra. Selecciona los que deseas actualizar.
			</p>

			<div class="rounded-lg border border-slate-200">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-3">
								<input
									type="checkbox"
									checked={allSelected}
									onchange={toggleAll}
									class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
								/>
							</th>
							<th class="px-4 py-3">Producto</th>
							<th class="px-4 py-3 text-right">Precio Actual</th>
							<th class="px-4 py-3 text-center"></th>
							<th class="px-4 py-3 text-right">Precio Sugerido</th>
						</tr>
					</thead>
					<tbody>
						{#each suggestions as suggestion (suggestion.productId)}
							{@const isUp =
								suggestion.currentSalePrice !== null &&
								suggestion.suggestedSalePrice > suggestion.currentSalePrice}
							{@const isDown =
								suggestion.currentSalePrice !== null &&
								suggestion.suggestedSalePrice < suggestion.currentSalePrice}
							<tr class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
								<td class="px-4 py-3">
									<input
										type="checkbox"
										checked={selected[suggestion.productId] ?? false}
										onchange={(e) => toggleOne(suggestion.productId, e)}
										class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
									/>
								</td>
								<td class="px-4 py-3">
									<div class="font-medium text-slate-900">{suggestion.productName}</div>
									<div class="font-mono text-xs text-slate-400">{suggestion.productSku}</div>
								</td>
								<td class="px-4 py-3 text-right font-mono tabular-nums">
									{#if suggestion.currentSalePrice !== null}
										<span class="text-slate-600">{formatPrice(suggestion.currentSalePrice)}</span>
									{:else}
										<span class="text-slate-400">Sin precio</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-center">
									<ArrowRight class="mx-auto h-4 w-4 text-slate-300" />
								</td>
								<td class="px-4 py-3 text-right font-mono font-semibold tabular-nums">
									<span
										class={isUp ? 'text-emerald-600' : isDown ? 'text-amber-600' : 'text-slate-900'}
									>
										{formatPrice(suggestion.suggestedSalePrice)}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<Dialog.Footer class="flex items-center justify-between">
			<span class="text-sm text-slate-500">
				{selectedCount} de {suggestions.length} seleccionados
			</span>
			<div class="flex gap-2">
				<Button variant="outline" onclick={onSkip} disabled={loading}>Omitir</Button>
				<Button onclick={handleApply} disabled={loading || selectedCount === 0}>
					{#if loading}<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
							><circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/><path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/></svg
						>{/if}
					<Check class="mr-1 h-4 w-4" />
					Aplicar ({selectedCount})
				</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
