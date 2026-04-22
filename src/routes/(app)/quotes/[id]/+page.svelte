<script lang="ts">
	import {
		Package,
		FileText,
		CircleX,
		Eye,
		FlaskConical,
		ArrowRightCircle,
		UserPlus,
		Save,
		ClipboardList
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		QuoteStatusBadge,
		ConfirmModal,
		PageHeader,
		EconomicBreakdownCard
	} from '$lib/components/ui';
	import { cancelQuote, convertQuoteToSale, assignQuoteCustomer } from '$lib/remote/quotes.remote';
	import { canOperate } from '$lib/shared/enums';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations, QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import CustomerLookupInput from '$lib/components/sales/CustomerLookupInput.svelte';
	import {
		buildPersistedDisplayGroups,
		computeSnapshotTaxBreakdown
	} from '$lib/components/sales/saleItemHelpers';
	import { formatPrescriptionEye, hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import { untrack } from 'svelte';

	let { data } = $props();
	let quote = $state<QuoteWithRelations>(untrack(() => data.quote));
	let items = $state<QuoteItemWithDetails[]>(untrack(() => data.items));

	let formattedQuoteNumber = $derived(`P-${String(quote.quoteNumber).padStart(4, '0')}`);
	let canAct = $derived(canOperate(data.user.role));
	let isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	let isConverted = $derived(quote.status === QuoteStatus.CONVERTED);
	let isCancelled = $derived(quote.status === QuoteStatus.CANCELLED);

	let mainItems = $derived(items.filter((i) => i.itemType !== SaleItemType.TREATMENT));

	let taxBreakdown = $derived(computeSnapshotTaxBreakdown(items));

	interface DisplayGroup {
		key: string;
		item: QuoteItemWithDetails;
		quantity: number;
		discountAmount: number;
		lineTotal: number;
		treatments: QuoteItemWithDetails[];
	}

	let displayGroups: DisplayGroup[] = $derived.by(() =>
		buildPersistedDisplayGroups(
			items,
			mainItems,
			SaleItemType.LENS_PAIR,
			SaleItemType.TREATMENT,
			(item) => item.parentQuoteItemId
		)
	);

	let actionLoading = $state(false);
	let showCancelModal = $state(false);
	let showConvertModal = $state(false);

	// Customer assignment state (for DRAFT quotes without customer)
	let assignCustomerId = $state('');
	let assignSelectedCustomer = $state<Customer | null>(null);
	let assignNewCustomer = $state<NewCustomerData | null>(null);
	let assigningCustomer = $state(false);

	function customerName(): string {
		if (!quote.customer) return 'Sin cliente';
		return `${quote.customer.firstName} ${quote.customer.lastName}`;
	}

	function customerIdNumber(): string {
		return quote.customer?.idNumber ?? '';
	}

	function actionButtonClasses(variant: 'neutral' | 'danger'): string {
		if (variant === 'danger') {
			return 'bg-error-container text-on-error-container hover:bg-error-container/80';
		}

		return 'bg-surface-container-low text-brand-navy hover:bg-surface-container-high';
	}

	async function handleAssignCustomer() {
		const hasNew = assignNewCustomer && assignNewCustomer.firstName && assignNewCustomer.lastName;
		if (!assignCustomerId && !hasNew) {
			toast.error('Busque o ingrese un cliente primero');
			return;
		}
		assigningCustomer = true;
		try {
			const result = await assignQuoteCustomer({
				id: quote.id,
				customerId: assignCustomerId || undefined,
				newCustomer: hasNew ? assignNewCustomer! : undefined
			});
			if (result.success) {
				toast.success('Cliente asignado al presupuesto');
				await invalidateAll();
				quote = data.quote;
				items = data.items;
			} else {
				toast.error(result.error ?? 'Error asignando cliente');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error asignando cliente'));
		} finally {
			assigningCustomer = false;
		}
	}

	async function handleCancel() {
		actionLoading = true;
		try {
			const result = await cancelQuote({ id: quote.id });
			if (result.success) {
				toast.success('Presupuesto cancelado');
				showCancelModal = false;
				await invalidateAll();
				quote = data.quote;
				items = data.items;
			} else {
				toast.error(result.error ?? 'Error cancelando presupuesto');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cancelando presupuesto'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleConvert() {
		actionLoading = true;
		try {
			const result = await convertQuoteToSale({ id: quote.id });
			if (result.success) {
				toast.success('Presupuesto convertido a venta exitosamente');
				showConvertModal = false;
				goto(resolve(`/sales/${result.sale.id}`));
			} else {
				toast.error(result.error ?? 'Error convirtiendo presupuesto');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error convirtiendo presupuesto'));
		} finally {
			actionLoading = false;
		}
	}

	function goBack() {
		goto(resolve('/quotes'));
	}
</script>

<svelte:head>
	<title>Presupuesto P-{quote.quoteNumber} - {customerName()} - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader
		title={`Presupuesto ${formattedQuoteNumber}`}
		subtitle="Detalle de presupuesto"
		backLabel="Volver a Presupuestos"
		backOnClick={goBack}
	>
		{#snippet actions()}
			{#if canAct && isDraft && quote.customer}
				<button
					type="button"
					onclick={() => (showConvertModal = true)}
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
					onclick={() => (showCancelModal = true)}
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

	<div class="-mt-2 flex flex-wrap items-center gap-3 text-on-surface-variant">
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Número</span>
			<span class="font-mono text-sm font-semibold text-brand-navy">{formattedQuoteNumber}</span>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Cliente</span>
			<span class="font-semibold text-brand-navy">{customerName()}</span>
			<span class="font-mono text-sm text-outline">{customerIdNumber() || 'Sin documento'}</span>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Fecha</span>
			<span class="font-semibold text-brand-navy"
				>{formatDate(quote.quoteDate, { dateStyle: 'medium' })}</span
			>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Vendedor</span>
			<span class="font-semibold text-brand-navy">{quote.seller?.fullName ?? 'Sin asignar'}</span>
		</div>
		{#if quote.validUntil}
			<div
				class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
			>
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
					>Válido hasta</span
				>
				<span class="font-semibold text-brand-navy"
					>{formatDate(quote.validUntil, { dateStyle: 'medium' })}</span
				>
			</div>
		{/if}
		<div class="inline-flex items-center rounded-xl bg-surface-container-low px-3 py-2 shadow-sm">
			<QuoteStatusBadge status={quote.status} />
		</div>
	</div>

	{#if quote.notes || isCancelled}
		<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
			{#if quote.notes}
				<section class="rounded-[1.5rem] bg-surface-container-low p-6">
					<div class="flex items-start gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-info-container text-on-info-container"
						>
							<FileText class="h-5 w-5" />
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
								Observaciones
							</p>
							<p class="mt-2 text-base leading-relaxed text-on-surface">{quote.notes}</p>
						</div>
					</div>
				</section>
			{/if}

			{#if isCancelled}
				<section class="rounded-[1.5rem] bg-error-container/70 p-6 text-on-error-container">
					<div class="flex items-start gap-3">
						<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/30">
							<CircleX class="h-5 w-5" />
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-70">Estado</p>
							<h2 class="mt-2 text-2xl font-semibold text-current">Presupuesto cancelado</h2>
							<p class="mt-1 text-sm leading-relaxed text-current/80">
								Este presupuesto ya no puede convertirse en venta ni recibir nuevas acciones.
							</p>
						</div>
					</div>
				</section>
			{/if}
		</div>
	{/if}

	{#if isConverted && quote.conversionSaleId}
		<div
			class="flex items-center gap-3 rounded-[1.5rem] bg-info-container/55 p-4 text-on-info-container"
		>
			<ArrowRightCircle class="h-5 w-5 text-blue-500" />
			<p class="text-base text-slate-700">
				Este presupuesto fue convertido a venta.
				<a
					href={resolve(`/sales/${quote.conversionSaleId}`)}
					class="font-semibold text-blue-600 hover:underline"
				>
					Ver venta
				</a>
			</p>
		</div>
	{/if}

	{#if canAct && isDraft && !quote.customer}
		<div class="rounded-[1.5rem] border border-surface-container-high bg-surface-container-low p-5">
			<div class="mb-3 flex items-center gap-2">
				<UserPlus class="h-4 w-4 text-slate-500" />
				<p class="text-sm font-medium text-slate-700">
					Asignar cliente para poder convertir a venta
				</p>
			</div>
			<div class="flex items-end gap-3">
				<div class="flex-1">
					<CustomerLookupInput
						bind:customerId={assignCustomerId}
						bind:selectedCustomer={assignSelectedCustomer}
						bind:newCustomer={assignNewCustomer}
					/>
				</div>
				<button
					type="button"
					onclick={handleAssignCustomer}
					disabled={assigningCustomer ||
						(!assignCustomerId && !(assignNewCustomer?.firstName && assignNewCustomer?.lastName))}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-navy transition disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
				>
					<Save class="h-4 w-4" />
					Guardar
				</button>
			</div>
		</div>
	{/if}

	<section class="glass-card overflow-hidden">
		<div
			class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<ClipboardList class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-xl font-semibold text-brand-navy">Artículos y servicios</h2>
					<p class="text-sm text-on-surface-variant">
						{displayGroups.length} línea{displayGroups.length !== 1 ? 's' : ''} principal{displayGroups.length !==
						1
							? 'es'
							: ''}
					</p>
				</div>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-surface-container-low text-left">
					<tr>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Artículo</th
						>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Tipo</th
						>
						<th
							class="px-6 py-4 text-center text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Cant.</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Precio unit.</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Desc.</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Subtotal</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-low">
					{#each displayGroups as group (group.key)}
						{@const item = group.item}
						{@const odSummary = formatPrescriptionEye(item, 'od')}
						{@const osSummary = formatPrescriptionEye(item, 'os')}
						<tr
							class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/35"
						>
							<td class="px-6 py-5 align-top">
								<div class="flex items-start gap-4">
									<div
										class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {item.itemType ===
										SaleItemType.LENS_PAIR
											? 'bg-info-container text-on-info-container'
											: 'bg-surface-container-low text-on-surface-variant'}"
									>
										{#if item.itemType === SaleItemType.LENS_PAIR}
											<Eye class="h-5 w-5" />
										{:else}
											<Package class="h-5 w-5" />
										{/if}
									</div>
									<div>
										<p class="text-lg leading-tight font-semibold text-brand-navy">
											{item.snapshotName ?? item.product?.name ?? item.lensCatalogItem?.name ?? '-'}
										</p>
										{#if item.snapshotSku}
											<span class="font-mono text-xs text-slate-400">{item.snapshotSku}</span>
										{/if}
										{#if item.snapshotBrand}
											<span
												class="ml-2 rounded bg-surface-container-low px-1.5 py-0.5 text-xs font-medium text-slate-600"
												>{item.snapshotBrand}</span
											>
										{/if}
										{#if item.itemType === SaleItemType.LENS_PAIR && hasPrescriptionSnapshot(item) && (odSummary || osSummary)}
											<div class="mt-2 space-y-1 text-xs text-on-surface-variant">
												{#if odSummary}
													<p class="font-mono">{odSummary}</p>
												{/if}
												{#if osSummary}
													<p class="font-mono">{osSummary}</p>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-6 py-5 align-top">
								<span
									class="inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase {item.itemType ===
									SaleItemType.LENS_PAIR
										? 'bg-info-container text-on-info-container'
										: 'bg-surface-container-high text-on-surface-variant'}"
								>
									{item.itemType === SaleItemType.LENS_PAIR ? 'Cristal' : 'Producto'}
								</span>
							</td>
							<td
								class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
								>{group.quantity}</td
							>
							<td
								class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant"
							>
								{formatPrice(item.unitPrice)}
							</td>
							<td
								class="px-6 py-5 text-right align-top font-mono text-base {group.discountAmount > 0
									? 'text-error'
									: 'text-outline'}"
							>
								{#if group.discountAmount > 0}
									-{formatPrice(group.discountAmount)}
									{#if item.discountType === DiscountType.PERCENTAGE}
										<span class="text-xs text-outline">({item.discount}%)</span>
									{/if}
								{:else}
									$0.00
								{/if}
							</td>
							<td
								class="px-6 py-5 text-right align-top font-mono text-lg font-bold text-brand-navy"
							>
								{formatPrice(group.lineTotal)}
							</td>
						</tr>

						{#each group.treatments as treatment (treatment.id)}
							<tr
								class="bg-surface-container-lowest/80 transition-colors hover:bg-surface-container-low/35"
							>
								<td class="px-6 py-5 align-top">
									<div class="flex items-start gap-4">
										<div
											class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-container text-on-purple-container"
										>
											<FlaskConical class="h-5 w-5" />
										</div>
										<div>
											<p class="text-lg leading-tight font-semibold text-brand-navy">
												{treatment.supplierTreatment?.name ??
													treatment.snapshotName ??
													'Tratamiento'}
											</p>
											{#if treatment.snapshotTreatmentCategory}
												<p class="mt-1 text-xs text-outline">
													{getTreatmentCategoryLabel(treatment.snapshotTreatmentCategory)}
												</p>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-6 py-5 align-top">
									<span
										class="inline-flex rounded-full bg-purple-container px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-on-purple-container uppercase"
										>Tratamiento</span
									>
								</td>
								<td
									class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
									>{treatment.quantity}</td
								>
								<td
									class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant"
								>
									{formatPrice(treatment.unitPrice)}
								</td>
								<td class="px-6 py-5 text-right align-top font-mono text-base text-outline"
									>$0.00</td
								>
								<td
									class="px-6 py-5 text-right align-top font-mono text-lg font-bold text-brand-navy"
								>
									{formatPrice(treatment.unitPrice * treatment.quantity)}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
				<tfoot class="bg-surface-container-low/60">
					<tr>
						<td
							colspan="5"
							class="px-6 py-5 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>
							Subtotal general
						</td>
						<td class="px-6 py-5 text-right font-mono text-2xl font-bold text-brand-navy">
							{formatPrice(quote.subtotal)}
						</td>
					</tr>
				</tfoot>
			</table>
		</div>
	</section>

	<section class="grid gap-4 xl:grid-cols-3">
		<EconomicBreakdownCard
			subtotal={quote.subtotal}
			total={quote.total}
			discountType={quote.discountType}
			discount={quote.discount}
			{taxBreakdown}
			totalLabel="Total estimado"
		/>

		<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Monto a cobrar</p>
			<p class="mt-4 font-mono text-3xl font-bold tracking-tight text-brand-navy md:text-4xl">
				{formatPrice(quote.total)}
			</p>
			<p class="mt-3 text-base text-on-surface-variant">
				Desglose estimado del importe que se cobraría al convertir este presupuesto en venta.
			</p>
		</div>

		<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
				Siguiente acción
			</p>
			<p class="mt-4 text-2xl font-semibold tracking-tight text-brand-navy">
				{#if isDraft && quote.customer}
					Listo para convertir
				{:else if isDraft}
					Asignar cliente
				{:else if isConverted}
					Ir a la venta creada
				{:else}
					Sin acciones disponibles
				{/if}
			</p>
			<p class="mt-3 text-base text-on-surface-variant">
				{#if isDraft && quote.customer}
					Este presupuesto ya tiene cliente asociado y puede convertirse directamente a venta.
				{:else if isDraft}
					Necesitas asignar un cliente antes de convertir el presupuesto a venta.
				{:else if isConverted}
					El documento ya fue convertido y ahora el seguimiento continúa en la venta resultante.
				{:else}
					El documento quedó fuera del flujo activo y se conserva solo como referencia.
				{/if}
			</p>
		</div>
	</section>
</div>

<!-- Cancel Confirmation -->
<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Presupuesto"
	message="¿Está seguro que desea cancelar este presupuesto?"
	confirmLabel="Cancelar Presupuesto"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>

<!-- Convert Confirmation -->
<ConfirmModal
	bind:open={showConvertModal}
	title="Convertir a Venta"
	message={`Se creará una nueva venta a nombre de ${customerName()} con los mismos artículos de este presupuesto. Se descontará el stock correspondiente.`}
	confirmLabel="Convertir a Venta"
	confirmColor="blue"
	loading={actionLoading}
	onConfirm={handleConvert}
	onCancel={() => (showConvertModal = false)}
/>
