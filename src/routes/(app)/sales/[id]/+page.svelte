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
		FlaskConical
	} from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SaleStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { PaymentForm, PaymentsTable } from '$lib/components/sales';
	import { cancelSale } from '$lib/remote/sales.remote';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { SaleStatus, DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleWithRelations, SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let sale = $state<SaleWithRelations>(untrack(() => data.sale));
	let items = $state<SaleItemWithDetails[]>(untrack(() => data.items));
	let payments = $state<SalePayment[]>(untrack(() => data.payments));
	let bcvRate = $state<number>(untrack(() => data.bcvRate));

	// Derived
	let remainingBcvUsd = $derived(Math.max(0, sale.total - sale.paidAmountBcvUsd));
	let isPending = $derived(sale.status === SaleStatus.PENDING);
	let isCompleted = $derived(sale.status === SaleStatus.COMPLETED);
	let isCancelled = $derived(sale.status === SaleStatus.CANCELLED);

	/** Main items (PRODUCT + LENS_PAIR), excluding TREATMENT rows */
	let mainItems = $derived(items.filter((i) => i.itemType !== SaleItemType.TREATMENT));

	/** Get treatment items for a given parent sale item */
	function getTreatments(parentId: string): SaleItemWithDetails[] {
		return items.filter(
			(i) => i.itemType === SaleItemType.TREATMENT && i.parentSaleItemId === parentId
		);
	}

	/** Grouped display rows — consolidates LENS_PAIR items that share the same catalog item */
	interface DisplayGroup {
		key: string;
		item: SaleItemWithDetails;
		quantity: number;
		discountAmount: number;
		lineTotal: number;
		treatments: SaleItemWithDetails[];
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

	// Action state
	let actionLoading = $state(false);
	let showCancelModal = $state(false);

	function customerName(): string {
		if (!sale.customer) return '—';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function customerIdNumber(): string {
		return sale.customer?.idNumber ?? '';
	}

	/** Compute item effective discount amount */
	function itemDiscountAmount(item: SaleItemWithDetails): number {
		if (item.discountType === DiscountType.PERCENTAGE) {
			return (item.discount / 100) * item.unitPrice * item.quantity;
		}
		return item.discount;
	}

	async function handleCancel() {
		actionLoading = true;
		try {
			const result = await cancelSale({ id: sale.id });
			if (result.success) {
				toast.success('Venta cancelada');
				showCancelModal = false;
				await invalidateAll();
				sale = data.sale;
				items = data.items;
				payments = data.payments;
			} else {
				toast.error(result.error ?? 'Error cancelando venta');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cancelando venta'));
		} finally {
			actionLoading = false;
		}
	}

	async function handlePaymentAdded(_newPaidAmount: number) {
		await invalidateAll();
		sale = data.sale;
		items = data.items;
		payments = data.payments;
	}

	async function handlePaymentVoided() {
		await invalidateAll();
		sale = data.sale;
		items = data.items;
		payments = data.payments;
	}

	function goBack() {
		goto(resolve('/sales'));
	}
</script>

<svelte:head>
	<title>Venta #{sale.orderNumber} - {customerName()} - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Back button -->
	<button
		onclick={goBack}
		class="mb-4 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-blue-600"
	>
		<ArrowLeft class="h-4 w-4" />
		Volver a ventas
	</button>

	<!-- Sale Header Card -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold text-slate-900">Venta #{sale.orderNumber}</h1>
					<SaleStatusBadge status={sale.status} />
				</div>
				<p class="mt-1 font-mono text-sm text-slate-400">{sale.id}</p>
			</div>

			{#if isPending}
				<div class="flex gap-2">
					<Button color="red" outline onclick={() => (showCancelModal = true)}>
						<CircleX class="mr-2 h-5 w-5" />
						Cancelar Venta
					</Button>
				</div>
			{/if}
		</div>

		<!-- Info grid -->
		<div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
			<div class="flex items-center gap-3 rounded-lg bg-blue-50/60 p-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
					<Hash class="h-5 w-5 text-blue-600" />
				</div>
				<div>
					<p class="text-sm font-medium text-slate-500">Orden</p>
					<p class="font-mono text-base font-semibold text-blue-700">#{sale.orderNumber}</p>
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
					<User class="h-5 w-5 text-blue-600" />
				</div>
				<div>
					<p class="text-sm font-medium text-slate-500">Cliente</p>
					<p class="text-base font-semibold text-slate-900">{customerName()}</p>
					{#if customerIdNumber()}
						<p class="font-mono text-sm text-slate-500">{customerIdNumber()}</p>
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
					<Calendar class="h-5 w-5 text-purple-600" />
				</div>
				<div>
					<p class="text-sm font-medium text-slate-500">Fecha</p>
					<p class="text-base text-slate-900">{formatDate(sale.saleDate)}</p>
				</div>
			</div>

			{#if sale.seller}
				<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
						<User class="h-5 w-5 text-amber-600" />
					</div>
					<div>
						<p class="text-sm font-medium text-slate-500">Vendedor</p>
						<p class="text-base text-slate-900">{sale.seller.fullName}</p>
					</div>
				</div>
			{/if}
		</div>

		{#if sale.notes}
			<div class="mt-4 flex items-start gap-3 rounded-lg bg-amber-50 p-4">
				<FileText class="mt-0.5 h-5 w-5 text-amber-500" />
				<p class="text-base text-slate-700">{sale.notes}</p>
			</div>
		{/if}
	</div>

	<!-- Items Table -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold text-slate-900">Artículos</h2>

		<div class="overflow-x-auto rounded-lg border border-slate-200">
			<table class="w-full text-sm">
				<thead class="bg-slate-50">
					<tr>
						<th class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Artículo</th>
						<th class="px-4 py-3 text-center text-sm font-semibold text-slate-600">Tipo</th>
						<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">Cant.</th>
						<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">
							Precio Unit.
						</th>
						<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">Descuento</th>
						<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">Subtotal</th>
					</tr>
				</thead>
				<tbody>
					{#each displayGroups as group (group.key)}
						<tr class="border-t border-slate-100 transition-colors hover:bg-slate-50/50">
							<td class="px-4 py-3">
								<div class="flex items-center gap-3">
									{#if group.item.lensCatalogItem}
										<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
											<Eye class="h-4 w-4 text-indigo-500" />
										</div>
									{:else}
										<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
											<Package class="h-4 w-4 text-slate-500" />
										</div>
									{/if}
									<div>
										<p class="text-sm font-semibold text-slate-800">
											{group.item.product?.name ?? group.item.lensCatalogItem?.name ?? '—'}
										</p>
										{#if group.item.product?.sku}
											<p class="font-mono text-xs text-slate-500">{group.item.product.sku}</p>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-4 py-3 text-center">
								{#if group.item.lensCatalogItem}
									<span
										class="inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
										>Lente</span
									>
								{:else}
									<span
										class="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
										>Producto</span
									>
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono text-sm">{group.quantity}</td>
							<td class="px-4 py-3 text-right font-mono text-sm">
								{formatPrice(group.item.unitPrice)}
							</td>
							<td class="px-4 py-3 text-right font-mono text-sm text-red-500">
								{#if group.discountAmount > 0}
									-{formatPrice(group.discountAmount)}
									{#if group.item.discountType === DiscountType.PERCENTAGE}
										<span class="text-xs text-slate-400">({group.item.discount}%)</span>
									{/if}
								{:else}
									—
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono text-sm font-semibold">
								{formatPrice(group.lineTotal)}
							</td>
						</tr>
						<!-- Treatment rows -->
						{#each group.treatments as treatment (treatment.id)}
							<tr class="border-t border-slate-100 transition-colors hover:bg-slate-50/50">
								<td class="px-4 py-3">
									<div class="flex items-center gap-3">
										<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
											<FlaskConical class="h-4 w-4 text-violet-500" />
										</div>
										<div>
											<p class="text-sm font-semibold text-slate-800">
												{treatment.supplierTreatment?.name ?? '—'}
											</p>
											{#if treatment.supplierTreatment?.category}
												<span
													class="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600"
													>{getTreatmentCategoryLabel(treatment.supplierTreatment.category)}</span
												>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-4 py-3 text-center">
									<span
										class="inline-block rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-600"
										>Tratamiento</span
									>
								</td>
								<td class="px-4 py-3 text-right font-mono text-sm">{treatment.quantity}</td>
								<td class="px-4 py-3 text-right font-mono text-sm">
									{formatPrice(treatment.unitPrice)}
								</td>
								<td class="px-4 py-3 text-right font-mono text-sm text-red-500">—</td>
								<td class="px-4 py-3 text-right font-mono text-sm font-semibold text-violet-600">
									{formatPrice(treatment.unitPrice * treatment.quantity)}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Totals + Payment Balance -->
	<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Totals -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-xl font-semibold text-slate-900">Resumen</h3>
			<div class="space-y-3">
				<div class="flex justify-between text-base">
					<span class="text-slate-500">Subtotal</span>
					<span class="font-mono font-medium text-slate-700">{formatPrice(sale.subtotal)}</span>
				</div>
				{#if sale.discount > 0}
					<div class="flex justify-between text-base">
						<span class="text-slate-500">
							Descuento
							{#if sale.discountType === DiscountType.PERCENTAGE}
								({sale.discount}%)
							{/if}
						</span>
						<span class="font-mono font-medium text-red-500">
							-{formatPrice(
								sale.discountType === DiscountType.PERCENTAGE
									? (sale.discount / 100) * sale.subtotal
									: sale.discount
							)}
						</span>
					</div>
				{/if}
				<hr class="border-slate-200" />
				<div class="flex justify-between text-xl font-bold">
					<span class="text-slate-800">Total</span>
					<span class="font-mono text-blue-700">{formatPrice(sale.total)}</span>
				</div>
			</div>
		</div>

		<!-- Payment balance -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-xl font-semibold text-slate-900">Balance de Pagos</h3>
			<div class="space-y-3">
				<div class="flex justify-between text-base">
					<span class="text-slate-500">Total (USD BCV)</span>
					<span class="font-mono font-medium text-slate-700">{formatPrice(sale.total)}</span>
				</div>
				<div class="flex justify-between text-base">
					<span class="text-slate-500">Pagado (USD BCV)</span>
					<span class="font-mono font-medium text-emerald-600"
						>{formatPrice(sale.paidAmountBcvUsd)}</span
					>
				</div>
				<hr class="border-slate-200" />
				<div class="flex justify-between text-xl font-bold">
					<span class="text-slate-800">Pendiente</span>
					<span
						class="font-mono"
						class:text-red-600={remainingBcvUsd > 0.01}
						class:text-emerald-600={remainingBcvUsd <= 0.01}
					>
						{formatPrice(remainingBcvUsd)}
					</span>
				</div>
				{#if isCompleted}
					<div class="rounded-lg bg-emerald-50 p-2 text-center">
						<p class="text-sm font-semibold text-emerald-700">Venta completada</p>
					</div>
				{:else if isCancelled}
					<div class="rounded-lg bg-red-50 p-2 text-center">
						<p class="text-sm font-semibold text-red-600">Venta cancelada</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Payments Section -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-xl font-semibold text-slate-900">Pagos</h2>

		{#if payments.length > 0}
			<PaymentsTable
				{payments}
				saleId={sale.id}
				allowVoid={isPending}
				onPaymentVoided={handlePaymentVoided}
			/>
		{:else}
			<p class="py-6 text-center text-base text-slate-400">No hay pagos registrados</p>
		{/if}
	</div>

	<!-- Add Payment Form (only when sale is pending) -->
	{#if isPending && remainingBcvUsd > 0.01}
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold text-slate-900">Registrar Pago</h2>
			<PaymentForm
				saleId={sale.id}
				{remainingBcvUsd}
				{bcvRate}
				onPaymentAdded={handlePaymentAdded}
			/>
		</div>
	{/if}
</div>

<!-- Cancel Confirmation -->
<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Venta"
	message="¿Está seguro que desea cancelar esta venta? Se restaurará el stock de los productos y lentes."
	confirmLabel="Cancelar Venta"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>
