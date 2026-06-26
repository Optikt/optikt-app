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

<dl class="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4 lg:gap-4">
	<!-- Confirmed -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<CheckCircle2 class="h-4 w-4 shrink-0 text-success lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.confirmed.toLocaleString('es-VE')}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Confirmadas
			</dt>
		</div>
	</div>

	<!-- In Preparation -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<FileClock class="h-4 w-4 shrink-0 text-on-surface-variant lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.draftInProgress.toLocaleString('es-VE')}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				En preparación
			</dt>
		</div>
	</div>

	<!-- Ready -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<ClipboardCheck class="h-4 w-4 shrink-0 text-warning lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.draftReady.toLocaleString('es-VE')}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Listas
			</dt>
		</div>
	</div>

	<!-- Monthly Spend (dark accent) -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-brand-navy px-3 py-2 text-white lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<Coins class="h-4 w-4 shrink-0 text-brand-gold lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold lg:text-xl">
				{formatPrice(stats.monthlySpend)}
			</dd>
			<dt class="text-[10px] font-medium tracking-wide text-white/60 uppercase lg:text-[11px]">
				Gasto del mes
			</dt>
		</div>
	</div>
</dl>
