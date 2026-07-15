<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Ban, Check, ChevronLeft } from '@lucide/svelte';
	interface Props {
		showBack?: boolean;
		backLabel?: string;
		cancelLabel?: string;
		onCancel?: () => void;
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
		backLabel = 'Atrás',
		cancelLabel = 'Cancelar',
		onCancel,
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
	class="sticky bottom-0 z-20 rounded-t-lg border-t border-slate-200/60 bg-white/95 px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur"
>
	<div class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-2">
			{#if showBack}
				<button
					type="button"
					onclick={() => onBack?.()}
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
				>
					<ChevronLeft class="h-4 w-4" />
					<span class="hidden sm:inline">{backLabel}</span>
				</button>
			{/if}

			{#if onCancel}
				<button
					type="button"
					onclick={onCancel}
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-container/60"
				>
					<Ban class="h-4 w-4" />
					<span class="hidden sm:inline">{cancelLabel}</span>
				</button>
			{:else}
				<a
					href={resolve('/sales')}
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-container/60"
				>
					<Ban class="h-4 w-4" />
					<span class="hidden sm:inline">{cancelLabel}</span>
				</a>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			{#if summaryLabel && summaryValue}
				<div class="hidden text-right md:block">
					<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">
						{summaryLabel}
					</p>
					<p class="font-mono text-base font-bold text-brand-navy">{summaryValue}</p>
				</div>
			{/if}

			<button
				type="button"
				onclick={onPrimary}
				disabled={primaryDisabled || primaryLoading}
				class="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
			>
				{#if primaryLoading}
					<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
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
					>
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
