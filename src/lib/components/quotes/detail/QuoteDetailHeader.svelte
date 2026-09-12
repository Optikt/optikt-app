<script lang="ts">
	import { ArrowRightCircle, CircleX, FileText, Printer } from '@lucide/svelte';
	import { PageHeader } from '$lib/components/ui';
	import { actionButtonClasses } from './quoteDetail';

	interface Props {
		formattedQuoteNumber: string;
		canAct: boolean;
		isDraft: boolean;
		hasCustomer: boolean;
		onBack: () => void;
		onPreviewPdf: () => void;
		onOpenPdf: () => void;
		onConvert: () => void;
		onCancel: () => void;
	}

	let {
		formattedQuoteNumber,
		canAct,
		isDraft,
		hasCustomer,
		onBack,
		onPreviewPdf,
		onOpenPdf,
		onConvert,
		onCancel
	}: Props = $props();
</script>

<PageHeader
	title={`Presupuesto ${formattedQuoteNumber}`}
	subtitle="Detalle de presupuesto"
	backLabel="Volver a Presupuestos"
	backOnClick={onBack}
>
	{#snippet actions()}
		<button
			type="button"
			onclick={onPreviewPdf}
			class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
				'neutral'
			)}"
		>
			<FileText class="h-4 w-4" />
			Ver presupuesto
		</button>

		<button
			type="button"
			onclick={onOpenPdf}
			class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
				'neutral'
			)}"
		>
			<Printer class="h-4 w-4" />
			Imprimir PDF
		</button>

		{#if canAct && isDraft && hasCustomer}
			<button
				type="button"
				onclick={onConvert}
				class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
					'neutral'
				)}"
			>
				<ArrowRightCircle class="h-4 w-4" />
				Convertir a venta
			</button>
		{/if}

		{#if canAct && isDraft}
			<button
				type="button"
				onclick={onCancel}
				class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
					'danger'
				)}"
			>
				<CircleX class="h-4 w-4" />
				Cancelar presupuesto
			</button>
		{/if}
	{/snippet}
</PageHeader>
