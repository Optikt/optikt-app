<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ConfirmModal } from '$lib/components/ui';
	import CustomerSalesHistory from '$lib/components/customers/CustomerSalesHistory.svelte';
	import CustomerQuotesHistory from '$lib/components/customers/CustomerQuotesHistory.svelte';
	import type { HistoryQuote, HistorySale } from '$lib/server/db/queries/customerHistory';
	import type { Prescription } from '$lib/server/db/schema';
	import CustomerPrescriptionTable from './CustomerPrescriptionTable.svelte';

	export type CustomerHistoryTab = 'prescriptions' | 'sales' | 'quotes';

	interface Props {
		activeTab: CustomerHistoryTab;
		prescriptions: Prescription[];
		customerSales: HistorySale[];
		customerQuotes: HistoryQuote[];
		canAct: boolean;
		customerId: string;
		expandedId: string | null;
		showDeleteModal: boolean;
		deleteLoading: boolean;
		onToggleExpand: (id: string) => void;
		onDeleteRx: (prescription: Prescription) => void;
		onConfirmDelete: () => void;
	}

	let {
		activeTab = $bindable(),
		prescriptions,
		customerSales,
		customerQuotes,
		canAct,
		customerId,
		expandedId = $bindable(),
		showDeleteModal = $bindable(),
		deleteLoading,
		onToggleExpand,
		onDeleteRx,
		onConfirmDelete
	}: Props = $props();
</script>

<div class="mt-8 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="font-heading text-xl font-bold text-on-surface">Historial Completo</h2>
			<p class="text-sm text-on-surface-variant">
				Todo el historial de interacciones con el cliente
			</p>
		</div>

		<div class="flex items-center rounded-lg bg-surface-container-high p-1">
			<button
				class="flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none {activeTab ===
				'prescriptions'
					? 'bg-surface-container-lowest text-on-surface shadow-sm'
					: 'text-on-surface-variant hover:text-on-surface'}"
				onclick={() => (activeTab = 'prescriptions')}
			>
				Fórmulas ({prescriptions.length})
			</button>
			<button
				class="flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none {activeTab ===
				'sales'
					? 'bg-surface-container-lowest text-on-surface shadow-sm'
					: 'text-on-surface-variant hover:text-on-surface'}"
				onclick={() => (activeTab = 'sales')}
			>
				Ventas ({customerSales.length})
			</button>
			<button
				class="flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none {activeTab ===
				'quotes'
					? 'bg-surface-container-lowest text-on-surface shadow-sm'
					: 'text-on-surface-variant hover:text-on-surface'}"
				onclick={() => (activeTab = 'quotes')}
			>
				Presupuestos ({customerQuotes.length})
			</button>
		</div>
	</div>

	{#if activeTab === 'prescriptions'}
		<div class="mb-4 flex items-center justify-end">
			{#if canAct}
				<button
					onclick={() => goto(resolve(`/customers/${customerId}/prescriptions/new`))}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
				>
					<Plus class="h-4 w-4" />
					Nueva Fórmula
				</button>
			{/if}
		</div>

		<CustomerPrescriptionTable
			{prescriptions}
			{canAct}
			{customerId}
			{expandedId}
			{onToggleExpand}
			onDelete={onDeleteRx}
		/>
	{:else}
		<div class="py-4">
			{#if activeTab === 'sales'}
				<CustomerSalesHistory sales={customerSales} />
			{:else if activeTab === 'quotes'}
				<CustomerQuotesHistory quotes={customerQuotes} />
			{/if}
		</div>
	{/if}
</div>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Fórmula"
	message="¿Estás seguro de que deseas eliminar esta fórmula? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={onConfirmDelete}
/>
