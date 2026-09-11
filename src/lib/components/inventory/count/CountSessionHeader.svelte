<script lang="ts">
	import { ArrowLeft, Check, X } from '@lucide/svelte';

	interface Props {
		sessionId: number;
		status: string;
		canManage: boolean;
		canCloseSession: boolean;
		onBack: () => void;
		onOpenApply: () => void;
		onOpenCancel: () => void;
	}

	let { sessionId, status, canManage, canCloseSession, onBack, onOpenApply, onOpenCancel }: Props =
		$props();
</script>

<header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex min-w-0 items-center gap-3 overflow-hidden">
		<button
			type="button"
			onclick={onBack}
			class="inline-flex shrink-0 items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-brand-blue"
		>
			<ArrowLeft size={16} />
			Volver al historial
		</button>
		<p class="shrink-0 text-xs font-semibold tracking-widest text-slate-400 uppercase">
			{status === 'OPEN'
				? 'Conteo físico en ejecución'
				: status === 'APPLIED'
					? 'Informe de conteo físico'
					: 'Conteo físico cancelado'}
		</p>
		<h1
			class="font-heading min-w-0 truncate text-xl font-bold text-brand-navy sm:text-2xl lg:text-3xl"
		>
			Sesión #{sessionId}
		</h1>
	</div>

	{#if status === 'OPEN' && canManage}
		<div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
			<button
				type="button"
				onclick={onOpenApply}
				disabled={!canCloseSession}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Check class="h-4 w-4" />
				Cerrar sesión
			</button>
			<button
				type="button"
				onclick={onOpenCancel}
				class="inline-flex items-center gap-2 rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
			>
				<X class="h-4 w-4" />
				Cancelar sesión
			</button>
		</div>
	{/if}
</header>
