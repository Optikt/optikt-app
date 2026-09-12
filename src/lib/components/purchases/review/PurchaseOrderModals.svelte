<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import { ConfirmModal } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import { getPurchaseOrderReviewStatus } from '../purchaseOrderDraft';
	import type {
		PurchaseOrderDraftItem,
		PurchaseOrderDraftZeroValueField
	} from '../purchaseOrderDraft';
	import { buildWarningLines } from './purchaseReview';

	const ZERO_VALUE_FIELD_LABELS: Record<PurchaseOrderDraftZeroValueField, string> = {
		unitPurchasePrice: 'Costo und. en 0',
		unitSalePrice: 'Venta und. en 0'
	};

	interface Props {
		showDraftWarningModal: boolean;
		showPricingModeConfirmModal: boolean;
		showDocumentTypeConfirm: boolean;
		showSupplierConfirm: boolean;
		saving: boolean;
		items: PurchaseOrderDraftItem[];
		onDraftWarningConfirm: () => void;
		onDraftWarningCancel: () => void;
		onPricingModeConfirm: () => void;
		onPricingModeCancel: () => void;
		onDocumentTypeConfirm: (clearItems: boolean) => void;
		onDocumentTypeCancel: () => void;
		onSupplierConfirm: () => void;
		onSupplierCancel: () => void;
	}

	let {
		showDraftWarningModal = $bindable(),
		showPricingModeConfirmModal = $bindable(),
		showDocumentTypeConfirm = $bindable(),
		showSupplierConfirm = $bindable(),
		saving,
		items,
		onDraftWarningConfirm,
		onDraftWarningCancel,
		onPricingModeConfirm,
		onPricingModeCancel,
		onDocumentTypeConfirm,
		onDocumentTypeCancel,
		onSupplierConfirm,
		onSupplierCancel
	}: Props = $props();

	const warningLines = $derived(buildWarningLines(items));
	const pendingReviewCount = $derived(getPurchaseOrderReviewStatus(items).pendingCount);
	const unreviewedWarningLines = $derived(warningLines.unreviewed);
	const zeroValueWarningLines = $derived(warningLines.zeroValue);
</script>

<ConfirmModal
	bind:open={showDraftWarningModal}
	title="Advertencias del borrador"
	size="lg"
	confirmLabel="Guardar borrador"
	cancelLabel="Revisar líneas"
	confirmColor="yellow"
	loading={saving}
	onConfirm={onDraftWarningConfirm}
	onCancel={onDraftWarningCancel}
	permanent
>
	{#snippet icon()}
		<div
			class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
		>
			<AlertTriangle class="h-5 w-5" />
		</div>
	{/snippet}

	{#snippet body()}
		<div class="space-y-4 text-sm text-on-surface">
			<p>
				Puedes guardar el borrador, pero hay líneas que conviene revisar antes de continuar. Si un
				precio en 0 es deliberado, márcalo en la línea como 0 intencional.
			</p>

			{#if unreviewedWarningLines.length > 0}
				<div class="rounded-lg border border-warning/25 bg-warning-container/25 p-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-xs font-bold tracking-[0.14em] text-on-warning-container uppercase">
							Líneas sin check
						</p>
						<span class="font-mono text-xs font-semibold tabular-nums">
							{pendingReviewCount} pendiente(s)
						</span>
					</div>
					<div class="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
						{#each unreviewedWarningLines as line (line.id)}
							<div
								class="flex items-center justify-between gap-3 rounded-md bg-surface-container-lowest px-2 py-1.5 text-xs"
							>
								<span class="truncate font-mono font-semibold text-brand-navy">{line.title}</span>
								<span class="shrink-0 text-on-surface-variant">Cant. {line.quantity}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if zeroValueWarningLines.length > 0}
				<div class="max-h-72 space-y-2 overflow-y-auto pr-1">
					{#each zeroValueWarningLines as line (line.id)}
						<div class="rounded-lg border border-warning/25 bg-warning-container/30 p-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="truncate font-mono text-xs font-semibold text-brand-navy">
										{line.title}
									</p>
									<p class="mt-1 text-xs text-on-surface-variant">Cantidad: {line.quantity}</p>
								</div>
								<div class="flex shrink-0 flex-wrap justify-end gap-1">
									{#each line.fields as field (field)}
										<span
											class="text-on-warning rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase"
										>
											{ZERO_VALUE_FIELD_LABELS[field]}
										</span>
									{/each}
								</div>
							</div>

							<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
								<div class="rounded-md bg-surface-container-lowest px-2 py-1.5">
									<span class="text-on-surface-variant">Costo und.</span>
									<p class="font-mono font-semibold tabular-nums">
										{formatPrice(line.unitPurchasePrice)}
									</p>
								</div>
								<div class="rounded-md bg-surface-container-lowest px-2 py-1.5">
									<span class="text-on-surface-variant">Venta und.</span>
									<p class="font-mono font-semibold tabular-nums">
										{formatPrice(line.unitSalePrice)}
									</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}
</ConfirmModal>

<ConfirmModal
	bind:open={showPricingModeConfirmModal}
	title="Cambiar modo de precios"
	message="Cambiar la base de precios limpiará los costos actuales de todas las líneas para evitar mezclar bases distintas."
	confirmLabel="Cambiar y limpiar precios"
	cancelLabel="Mantener modo actual"
	confirmColor="yellow"
	onConfirm={onPricingModeConfirm}
	onCancel={onPricingModeCancel}
/>

<ConfirmModal
	bind:open={showDocumentTypeConfirm}
	title="¿Cambiar tipo de documento?"
	size="lg"
	confirmLabel="Limpiar"
	secondaryLabel="Mantener"
	cancelLabel="Cancelar"
	confirmColor="red"
	onConfirm={() => onDocumentTypeConfirm(true)}
	onSecondary={() => onDocumentTypeConfirm(false)}
	onCancel={onDocumentTypeCancel}
>
	{#snippet body()}
		<p class="text-sm text-on-surface">
			Ya tienes artículos agregados en el Paso 2. Cambiar de Factura a Nota de entrega (o viceversa)
			afectará el cálculo de IVA en los costos ingresados.
		</p>
	{/snippet}
</ConfirmModal>

<ConfirmModal
	bind:open={showSupplierConfirm}
	title="¿Cambiar proveedor?"
	size="md"
	confirmLabel="Cambiar"
	cancelLabel="Cancelar"
	confirmColor="red"
	onConfirm={onSupplierConfirm}
	onCancel={onSupplierCancel}
>
	{#snippet body()}
		<p class="text-sm text-on-surface">
			Ya tienes artículos agregados para el proveedor actual en el Paso 2. Cambiar de proveedor
			eliminará todos los artículos seleccionados.
		</p>
	{/snippet}
</ConfirmModal>
