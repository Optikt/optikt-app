<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import {
		ArrowLeft,
		User,
		Calendar,
		Package,
		FileText,
		Hash,
		CircleX,
		Eye,
		FlaskConical,
		ArrowRightCircle,
		Clock,
		UserPlus,
		Save
	} from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { QuoteStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { cancelQuote, convertQuoteToSale, assignQuoteCustomer } from '$lib/remote/quotes.remote';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations, QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import CustomerLookupInput from '$lib/components/sales/CustomerLookupInput.svelte';
	import { untrack } from 'svelte';

	let { data } = $props();
	let quote = $state<QuoteWithRelations>(untrack(() => data.quote));
	let items = $state<QuoteItemWithDetails[]>(untrack(() => data.items));

	let isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	let isConverted = $derived(quote.status === QuoteStatus.CONVERTED);

	let mainItems = $derived(items.filter((i) => i.itemType !== SaleItemType.TREATMENT));

	function getTreatments(parentId: string): QuoteItemWithDetails[] {
		return items.filter(
			(i) => i.itemType === SaleItemType.TREATMENT && i.parentQuoteItemId === parentId
		);
	}

	interface DisplayGroup {
		key: string;
		item: QuoteItemWithDetails;
		quantity: number;
		discountAmount: number;
		lineTotal: number;
		treatments: QuoteItemWithDetails[];
	}

	let displayGroups: DisplayGroup[] = $derived.by(() => {
		const groups: DisplayGroup[] = [];
		const lensGroupMap = new SvelteMap<string, DisplayGroup>();

		for (const item of mainItems) {
			if (item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItemId) {
				const existing = lensGroupMap.get(item.lensCatalogItemId);
				if (existing) {
					existing.quantity += item.quantity;
					existing.discountAmount += itemDiscountAmount(item);
					existing.lineTotal += item.unitPrice * item.quantity - itemDiscountAmount(item);
					existing.treatments.push(...getTreatments(item.id));
				} else {
					const discAmt = itemDiscountAmount(item);
					const group: DisplayGroup = {
						key: `lens-${item.lensCatalogItemId}`,
						item,
						quantity: item.quantity,
						discountAmount: discAmt,
						lineTotal: item.unitPrice * item.quantity - discAmt,
						treatments: [...getTreatments(item.id)]
					};
					lensGroupMap.set(item.lensCatalogItemId, group);
					groups.push(group);
				}
			} else {
				const discAmt = itemDiscountAmount(item);
				groups.push({
					key: item.id,
					item,
					quantity: item.quantity,
					discountAmount: discAmt,
					lineTotal: item.unitPrice * item.quantity - discAmt,
					treatments: getTreatments(item.id)
				});
			}
		}

		return groups;
	});

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

	function itemDiscountAmount(item: QuoteItemWithDetails): number {
		if (item.discountType === DiscountType.PERCENTAGE) {
			return (item.discount / 100) * item.unitPrice * item.quantity;
		}
		return item.discount;
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

<div class="p-8">
	<button
		onclick={goBack}
		class="mb-4 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-blue-600"
	>
		<ArrowLeft class="h-4 w-4" />
		Volver a presupuestos
	</button>

	<!-- Quote Header Card -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold text-slate-900">Presupuesto P-{quote.quoteNumber}</h1>
					<QuoteStatusBadge status={quote.status} />
				</div>
				<p class="mt-1 font-mono text-sm text-slate-400">{quote.id}</p>
			</div>
			<div class="flex gap-2">
				{#if isDraft && quote.customer}
					<Button color="blue" onclick={() => (showConvertModal = true)} disabled={actionLoading}>
						<ArrowRightCircle class="mr-2 h-5 w-5" />
						Convertir a Venta
					</Button>
				{/if}
				{#if isDraft}
					<Button
						color="red"
						outline
						onclick={() => (showCancelModal = true)}
						disabled={actionLoading}
					>
						<CircleX class="mr-2 h-5 w-5" />
						Cancelar
					</Button>
				{/if}
			</div>
		</div>

		<!-- Info grid -->
		<div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
			<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
					<Hash class="h-5 w-5 text-blue-600" />
				</div>
				<div>
					<p class="text-xs text-slate-400">Nº Presupuesto</p>
					<p class="font-mono text-lg font-bold text-slate-900">P-{quote.quoteNumber}</p>
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
					<User class="h-5 w-5 text-emerald-600" />
				</div>
				<div>
					<p class="text-xs text-slate-400">Cliente</p>
					<p class="text-base font-semibold text-slate-900">{customerName()}</p>
					{#if customerIdNumber()}
						<p class="font-mono text-xs text-slate-400">{customerIdNumber()}</p>
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
					<Calendar class="h-5 w-5 text-amber-600" />
				</div>
				<div>
					<p class="text-xs text-slate-400">Fecha</p>
					<p class="font-mono text-base font-semibold text-slate-900">
						{formatDate(quote.quoteDate, { month: 'short' })}
					</p>
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
					{#if quote.validUntil}
						<Clock class="h-5 w-5 text-violet-600" />
					{:else}
						<User class="h-5 w-5 text-violet-600" />
					{/if}
				</div>
				<div>
					{#if quote.validUntil}
						<p class="text-xs text-slate-400">Válido hasta</p>
						<p class="font-mono text-base font-semibold text-slate-900">
							{formatDate(quote.validUntil, { month: 'short' })}
						</p>
					{:else}
						<p class="text-xs text-slate-400">Vendedor</p>
						<p class="text-base font-semibold text-slate-900">
							{quote.seller?.fullName ?? '—'}
						</p>
					{/if}
				</div>
			</div>
		</div>

		{#if quote.notes}
			<div class="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-4">
				<FileText class="mt-0.5 h-5 w-5 text-amber-500" />
				<p class="text-base text-slate-700">{quote.notes}</p>
			</div>
		{/if}

		{#if isConverted && quote.conversionSaleId}
			<div class="mt-4 flex items-center gap-3 rounded-lg bg-blue-50 p-4">
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

		{#if isDraft && !quote.customer}
			<div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
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
					<Button
						color="blue"
						size="sm"
						onclick={handleAssignCustomer}
						disabled={assigningCustomer ||
							(!assignCustomerId && !(assignNewCustomer?.firstName && assignNewCustomer?.lastName))}
					>
						<Save class="mr-1.5 h-4 w-4" />
						Guardar
					</Button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Items Table -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold text-slate-900">Artículos</h2>
		<div class="overflow-x-auto rounded-lg border border-slate-200">
			<table class="w-full text-sm">
				<thead class="bg-slate-100 text-slate-600">
					<tr>
						<th class="px-4 py-3 text-left font-semibold">Tipo</th>
						<th class="px-4 py-3 text-left font-semibold">Artículo</th>
						<th class="px-4 py-3 text-right font-semibold">Cant.</th>
						<th class="px-4 py-3 text-right font-semibold">P. Unit.</th>
						<th class="px-4 py-3 text-right font-semibold">Desc.</th>
						<th class="px-4 py-3 text-right font-semibold">Subtotal</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each displayGroups as group (group.key)}
						{@const item = group.item}
						<tr class="text-slate-700 hover:bg-slate-50/50">
							<td class="px-4 py-3">
								{#if item.itemType === SaleItemType.LENS_PAIR}
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700"
									>
										<Eye class="h-3 w-3" />
										Lente
									</span>
								{:else}
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"
									>
										<Package class="h-3 w-3" />
										Producto
									</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<p class="text-base font-medium">{item.snapshotName ?? '—'}</p>
								{#if item.snapshotSku}
									<span class="font-mono text-xs text-slate-400">{item.snapshotSku}</span>
								{/if}
								{#if item.snapshotBrand}
									<span
										class="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600"
										>{item.snapshotBrand}</span
									>
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono text-base">{group.quantity}</td>
							<td class="px-4 py-3 text-right font-mono text-base">
								{formatPrice(item.unitPrice)}
							</td>
							<td class="px-4 py-3 text-right font-mono text-base text-red-500">
								{#if group.discountAmount > 0}
									-{formatPrice(group.discountAmount)}
								{:else}
									—
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono text-base font-semibold">
								{formatPrice(group.lineTotal)}
							</td>
						</tr>
						<!-- Treatments -->
						{#each group.treatments as treatment (treatment.id)}
							<tr class="border-t border-violet-100 bg-violet-50/30 text-slate-700">
								<td class="px-4 py-2">
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700"
									>
										<FlaskConical class="h-3 w-3" />
										Tratamiento
									</span>
								</td>
								<td class="px-4 py-2">
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium text-violet-800">
											{treatment.snapshotName ?? treatment.supplierTreatment?.name ?? '—'}
										</p>
										{#if treatment.snapshotTreatmentCategory}
											<span
												class="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600"
												>{getTreatmentCategoryLabel(treatment.snapshotTreatmentCategory)}</span
											>
										{/if}
									</div>
								</td>
								<td class="px-4 py-2 text-right font-mono text-sm">{treatment.quantity}</td>
								<td class="px-4 py-2 text-right font-mono text-sm">
									{formatPrice(treatment.unitPrice)}
								</td>
								<td class="px-4 py-2 text-right font-mono text-sm text-red-500">—</td>
								<td class="px-4 py-2 text-right font-mono text-sm font-semibold text-violet-700">
									{formatPrice(treatment.unitPrice * treatment.quantity)}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Totals -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold text-slate-900">Resumen</h2>
		<div class="space-y-3">
			<div class="flex justify-between text-base">
				<span class="text-slate-600">Subtotal</span>
				<span class="font-mono font-semibold text-slate-800">{formatPrice(quote.subtotal)}</span>
			</div>
			{#if quote.discount > 0}
				<div class="flex justify-between text-base">
					<span class="text-slate-600">
						Descuento
						{#if quote.discountType === DiscountType.PERCENTAGE}
							({quote.discount}%)
						{/if}
					</span>
					<span class="font-mono font-semibold text-red-500">
						-{formatPrice(quote.subtotal - quote.total)}
					</span>
				</div>
			{/if}
			<div class="flex justify-between border-t border-slate-200 pt-3 text-lg">
				<span class="font-bold text-slate-900">Total</span>
				<span class="font-mono text-xl font-bold text-blue-600">{formatPrice(quote.total)}</span>
			</div>
		</div>
	</div>
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
