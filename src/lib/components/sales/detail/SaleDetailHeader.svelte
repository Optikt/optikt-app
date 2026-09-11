<script lang="ts">
	import { ArrowLeft, CircleX, FileText, Pen, Play, Printer, ReceiptText } from '@lucide/svelte';
	import { CasheaIsotipo } from '$lib/components/branding';

	interface Props {
		formattedOrderNumber: string;
		isCashea: boolean;
		canPrintReceipt: boolean;
		canManageSale: boolean;
		isCancelled: boolean;
		isPending: boolean;
		isInProgress: boolean;
		isReady: boolean;
		isCompleted: boolean;
		isAdmin: boolean;
		printingTickera: boolean;
		onBack: () => void;
		onPreviewPdf: () => void;
		onOpenPdf: () => void;
		onPrintTickera: () => void;
		onChangeStatus: () => void;
		onEdit: () => void;
		onCancel: () => void;
	}

	let {
		formattedOrderNumber,
		isCashea,
		canPrintReceipt,
		canManageSale,
		isCancelled,
		isPending,
		isInProgress,
		isReady,
		isCompleted,
		isAdmin,
		printingTickera,
		onBack,
		onPreviewPdf,
		onOpenPdf,
		onPrintTickera,
		onChangeStatus,
		onEdit,
		onCancel
	}: Props = $props();
</script>

<button
	type="button"
	onclick={onBack}
	class="mb-2 flex cursor-pointer items-center gap-1.5 text-sm text-outline transition-colors hover:text-brand-blue"
>
	<ArrowLeft class="h-4 w-4" />
	Volver a Ventas
</button>

<div
	class="mb-4 flex flex-col items-start justify-between gap-4 rounded-[var(--ds-radius-xl)] border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-[var(--ds-shadow-md)] sm:flex-row sm:items-center"
>
	<div>
		<p class="text-xs font-semibold tracking-widest text-on-surface-variant uppercase">
			Detalle de venta
		</p>
		<div class="flex items-center gap-2">
			<h1 class="mt-0 text-2xl font-bold text-on-surface">
				Venta {formattedOrderNumber}
			</h1>
			{#if isCashea}
				<span
					class="inline-flex items-center rounded-md bg-surface-container-high px-1.5 py-0.5 ring-1 ring-outline-variant/40"
					title="Venta con Cashea"
					aria-label="Venta con Cashea"
				>
					<CasheaIsotipo class="h-5 w-5" />
				</span>
			{/if}
		</div>
	</div>

	<div class="flex shrink-0 flex-wrap items-center gap-3">
		{#if canPrintReceipt}
			<button
				type="button"
				onclick={onPreviewPdf}
				class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant shadow-[var(--ds-shadow-md)] transition-colors hover:bg-surface-container-low"
			>
				<FileText class="h-4 w-4" />
				Ver Recibo
			</button>

			<button
				type="button"
				onclick={onOpenPdf}
				class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant shadow-[var(--ds-shadow-md)] transition-colors hover:bg-surface-container-low"
			>
				<Printer class="h-4 w-4" />
				Imprimir PDF
			</button>

			<button
				type="button"
				onclick={onPrintTickera}
				disabled={printingTickera}
				class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant shadow-[var(--ds-shadow-md)] transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
			>
				<ReceiptText class="h-4 w-4" />
				{printingTickera ? 'Imprimiendo...' : 'Imprimir Tickera'}
			</button>
		{/if}

		{#if canManageSale && !isCancelled && (isPending || isInProgress || isReady || (isCompleted && isAdmin))}
			<button
				type="button"
				onclick={onChangeStatus}
				class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] bg-brand-blue px-4 py-2 text-xs font-bold text-on-primary shadow-[var(--ds-shadow-md)] transition-colors hover:bg-brand-blue-dark"
			>
				<Play class="h-4 w-4" />
				Cambiar Estado
			</button>
		{/if}

		{#if canManageSale && (isPending || isInProgress || isReady)}
			<button
				type="button"
				onclick={onEdit}
				class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-info-container px-3 py-2 text-xs font-semibold text-on-info-container shadow-[var(--ds-shadow-md)] transition-colors hover:bg-info-container"
			>
				<Pen class="h-4 w-4" />
				Editar
			</button>
		{/if}

		{#if canManageSale && (isPending || isInProgress || isReady)}
			<div class="ml-4 border-l border-error-container pl-4">
				<button
					type="button"
					onclick={onCancel}
					class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-error-container px-3 py-2 text-xs font-semibold text-on-error-container shadow-[var(--ds-shadow-md)] transition-colors hover:bg-error-container"
				>
					<CircleX class="h-4 w-4" />
					Cancelar
				</button>
			</div>
		{/if}
	</div>
</div>
