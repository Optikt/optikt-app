<script lang="ts">
	import { CheckCircle2, ClipboardCheck, Coins, FileClock } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';

	interface PurchaseStats {
		confirmed: number;
		draftInProgress: number;
		draftReady: number;
		monthlySpend: number;
	}

	let { stats }: { stats: PurchaseStats } = $props();
</script>

<dl class="grid grid-cols-4 gap-2 text-sm lg:gap-4">
	<!-- Confirmed -->
	<div
		class="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 lg:px-3.5 lg:py-2.5"
	>
		<CheckCircle2 class="h-4 w-4 shrink-0 text-success lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dt
				class="truncate text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Confirmadas
			</dt>
			<dd class="font-heading text-lg leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.confirmed.toLocaleString('es-VE')}
			</dd>
		</div>
	</div>

	<!-- In Preparation -->
	<div
		class="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 lg:px-3.5 lg:py-2.5"
	>
		<FileClock class="h-4 w-4 shrink-0 text-on-surface-variant lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dt
				class="truncate text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				En prep.
			</dt>
			<dd class="font-heading text-lg leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.draftInProgress.toLocaleString('es-VE')}
			</dd>
		</div>
	</div>

	<!-- Ready -->
	<div
		class="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 lg:px-3.5 lg:py-2.5"
	>
		<ClipboardCheck class="h-4 w-4 shrink-0 text-warning lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dt
				class="truncate text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Listas
			</dt>
			<dd class="font-heading text-lg leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.draftReady.toLocaleString('es-VE')}
			</dd>
		</div>
	</div>

	<!-- Monthly Spend (dark accent) -->
	<div
		class="flex items-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-white lg:px-3.5 lg:py-2.5"
	>
		<Coins class="h-4 w-4 shrink-0 text-brand-gold lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dt
				class="truncate text-[10px] font-medium tracking-wide text-white/60 uppercase lg:text-[11px]"
			>
				Gasto mes
			</dt>
			<dd class="font-heading text-lg leading-tight font-bold lg:text-xl">
				{formatPrice(stats.monthlySpend)}
			</dd>
		</div>
	</div>
</dl>
