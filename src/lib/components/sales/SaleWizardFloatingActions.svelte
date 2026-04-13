<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Ban, Check, ChevronLeft } from '@lucide/svelte';
	import { Spinner } from 'flowbite-svelte';

	interface Props {
		showBack?: boolean;
		backLabel?: string;
		cancelLabel?: string;
		primaryLabel: string;
		primaryDisabled?: boolean;
		primaryLoading?: boolean;
		primaryKind?: 'next' | 'confirm';
		summaryLabel?: string;
		summaryValue?: string;
		onBack?: () => void;
		onPrimary: () => void;
	}

	let {
		showBack = false,
		backLabel = 'Atras',
		cancelLabel = 'Cancelar',
		primaryLabel,
		primaryDisabled = false,
		primaryLoading = false,
		primaryKind = 'next',
		summaryLabel,
		summaryValue,
		onBack,
		onPrimary
	}: Props = $props();
</script>

<div
	class="sticky bottom-4 z-20 rounded-[1.25rem] bg-white/92 px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.10)] ring-1 ring-white/80 backdrop-blur"
>
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex flex-wrap items-center gap-3">
			{#if showBack}
				<button
					type="button"
					onclick={() => onBack?.()}
					class="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
				>
					<ChevronLeft class="h-4 w-4" />
					<span>{backLabel}</span>
				</button>
			{/if}

			<a
				href={resolve('/sales')}
				class="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-error transition-colors hover:bg-error-container/60"
			>
				<Ban class="h-4 w-4" />
				<span>{cancelLabel}</span>
			</a>
		</div>

		<div class="flex flex-wrap items-center justify-end gap-4">
			{#if summaryLabel && summaryValue}
				<div class="hidden text-right md:block">
					<p class="text-[12px] font-bold tracking-[0.18em] text-outline uppercase">
						{summaryLabel}
					</p>
					<p class="font-mono text-lg font-bold text-brand-navy">{summaryValue}</p>
				</div>
			{/if}

			<button
				type="button"
				onclick={onPrimary}
				disabled={primaryDisabled || primaryLoading}
				class="inline-flex items-center gap-3 rounded-xl bg-brand-gold px-6 py-3.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
			>
				{#if primaryLoading}
					<Spinner size="4" />
				{:else if primaryKind === 'confirm'}
					<Check class="h-4 w-4" />
				{:else}
					<ArrowRight class="h-4 w-4" />
				{/if}
				<span>{primaryLabel}</span>
			</button>
		</div>
	</div>
</div>
