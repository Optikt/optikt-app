<script lang="ts">
	import { Target } from '@lucide/svelte';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { AppBadge } from '$lib/components/ui';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import { formatDate } from '$lib/utils';

	interface Props {
		item: LensCatalogItemWithRelations;
	}

	let { item }: Props = $props();

	const displayRanges = $derived(collapseRangesForDisplay(item.ranges));
</script>

<section class="rounded-[1.75rem] bg-surface-container-low px-6 py-6 shadow-sm sm:px-7">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<div class="flex items-center gap-3">
				<div class="h-9 w-1.5 rounded-full bg-brand-gold"></div>
				<div>
					<p class="text-xs font-semibold tracking-[0.16em] text-brand-gold uppercase">
						Lectura óptica
					</p>
					<h2 class="font-heading mt-1 text-2xl font-bold text-brand-navy">Rangos ópticos</h2>
				</div>
			</div>
		</div>

		<div class="flex flex-wrap gap-2 sm:justify-end">
			<AppBadge variant="neutral">
				{displayRanges.length} rango{displayRanges.length === 1 ? '' : 's'}
			</AppBadge>
			<AppBadge variant="neutral">
				Actualizado {formatDate(item.updatedAt, { dateStyle: 'medium' })}
			</AppBadge>
		</div>
	</div>

	{#if displayRanges.length > 0}
		<div class="mt-6 grid gap-4 md:grid-cols-2">
			{#each displayRanges as range, index (range.id)}
				<article class="rounded-[1.5rem] bg-surface-container-lowest p-5 shadow-sm">
					<div class="flex items-center justify-between gap-3">
						<div class="flex items-center gap-2">
							<p class="text-[10px] font-semibold tracking-[0.18em] text-outline uppercase">
								Rango {index + 1}
							</p>
							{#if range.symmetric}
								<AppBadge variant="purple">Simétrico ±</AppBadge>
							{/if}
						</div>
					</div>

					<div class="mt-4 flex flex-wrap gap-x-6 gap-y-3">
						<div class="flex items-center gap-2">
							<div class="h-3 w-1 rounded-full bg-info-container"></div>
							<span class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase"
								>Esf</span
							>
							<span
								class="font-mono text-sm font-bold tracking-tight whitespace-nowrap text-brand-navy"
								>{range.sphereLabel}</span
							>
						</div>

						{#if range.cylinderLabel}
							<div class="flex items-center gap-2">
								<div class="h-3 w-1 rounded-full bg-warning-container"></div>
								<span class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase"
									>Cil</span
								>
								<span
									class="font-mono text-sm font-bold tracking-tight whitespace-nowrap text-brand-navy"
									>{range.cylinderLabel}</span
								>
							</div>
						{/if}

						{#if range.additionLabel}
							<div class="flex items-center gap-2">
								<div class="h-3 w-1 rounded-full bg-purple-container"></div>
								<span class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase"
									>Add</span
								>
								<span
									class="font-mono text-sm font-bold tracking-tight whitespace-nowrap text-brand-navy"
									>{range.additionLabel}</span
								>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<div class="mt-6 rounded-[1.5rem] bg-surface-container-lowest px-6 py-8 text-center shadow-sm">
			<div
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-high text-brand-navy"
			>
				<Target class="h-5 w-5" />
			</div>
			<h3 class="font-heading mt-4 text-xl font-bold text-brand-navy">Sin rangos registrados</h3>
			<p class="mt-2 text-sm leading-7 text-on-surface-variant">
				Este lente todavía no tiene una cobertura óptica configurada.
			</p>
		</div>
	{/if}

	{#if item.notes}
		<div class="mt-6 rounded-[1.5rem] bg-surface-container-lowest px-5 py-5 shadow-sm">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
				Notas internas
			</p>
			<p class="mt-3 text-sm leading-7 whitespace-pre-wrap text-on-surface-variant">
				{item.notes}
			</p>
		</div>
	{/if}
</section>
