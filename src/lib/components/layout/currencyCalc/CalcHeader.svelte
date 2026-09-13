<script lang="ts">
	import { RefreshCw, X } from '@lucide/svelte';

	interface Props {
		refreshing: boolean;
		onRefresh: (event: MouseEvent) => void;
		onClose: () => void;
	}

	let { refreshing, onRefresh, onClose }: Props = $props();
</script>

<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
	<div>
		<h2 id="calc-modal-title" class="text-sm font-semibold text-brand-navy">
			Calculadora de monedas
		</h2>
		<p class="mt-0.5 text-[11px] text-slate-400">Tasas sincronizadas en segundo plano</p>
	</div>
	<div class="flex items-center gap-1.5">
		<button
			type="button"
			class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue transition-colors hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={onRefresh}
			disabled={refreshing}
			title="Refrescar tasas"
		>
			<RefreshCw class={refreshing ? 'animate-spin' : ''} size={14} />
		</button>
		<button
			type="button"
			class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
			onclick={onClose}
			aria-label="Cerrar calculadora"
		>
			<X size={16} />
		</button>
	</div>
</div>
