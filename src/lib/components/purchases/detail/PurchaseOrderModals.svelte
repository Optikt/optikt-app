<script lang="ts">
	import { ConfirmModal } from '$lib/components/ui';
	import { PriceSuggestionModal } from '$lib/components/purchases';
	import { formatPrice } from '$lib/utils';
	import type { PriceSuggestion } from '$lib/remote/purchaseOrders.remote';
	import type { RevertTarget } from './purchaseDetail';

	interface Props {
		showConfirmModal: boolean;
		showConfirmAndPayModal: boolean;
		showMarkReadyModal: boolean;
		showUnmarkReadyModal: boolean;
		showCancelModal: boolean;
		showPriceSuggestionModal: boolean;
		showRevertModal: boolean;
		actionLoading: boolean;
		revertLoading: boolean;
		priceLoading: boolean;
		markReadyMessage: string;
		unmarkReadyMessage: string;
		priceSuggestions: PriceSuggestion[];
		revertTarget: RevertTarget | null;
		netTotalPurchase: number;
		onConfirm: () => void;
		onConfirmAndPay: () => void;
		onMarkReady: () => void;
		onUnmarkReady: () => void;
		onCancel: () => void;
		onApplyPrices: (updates: { productId: string; newSalePrice: number }[]) => void;
		onSkipPrices: () => void;
		onRevertLot: () => void;
		onRevertCancel: () => void;
	}

	let {
		showConfirmModal = $bindable(),
		showConfirmAndPayModal = $bindable(),
		showMarkReadyModal = $bindable(),
		showUnmarkReadyModal = $bindable(),
		showCancelModal = $bindable(),
		showPriceSuggestionModal = $bindable(),
		showRevertModal = $bindable(),
		actionLoading,
		revertLoading,
		priceLoading,
		markReadyMessage,
		unmarkReadyMessage,
		priceSuggestions,
		revertTarget,
		netTotalPurchase,
		onConfirm,
		onConfirmAndPay,
		onMarkReady,
		onUnmarkReady,
		onCancel,
		onApplyPrices,
		onSkipPrices,
		onRevertLot,
		onRevertCancel
	}: Props = $props();
</script>

<ConfirmModal
	bind:open={showConfirmModal}
	title="Confirmar Orden de Compra"
	message="Al confirmar esta orden se crearán los lotes de inventario y se actualizará el stock de los productos. Esta acción no se puede deshacer."
	confirmLabel="Confirmar Orden"
	confirmColor="green"
	loading={actionLoading}
	{onConfirm}
	onCancel={() => (showConfirmModal = false)}
/>

<ConfirmModal
	bind:open={showConfirmAndPayModal}
	title="Confirmar y registrar pago"
	message={`Se confirmará la orden y luego se abrirá el formulario de pago con el total neto precargado (${formatPrice(netTotalPurchase)}).`}
	confirmLabel="Confirmar y continuar"
	confirmColor="green"
	loading={actionLoading}
	onConfirm={onConfirmAndPay}
	onCancel={() => (showConfirmAndPayModal = false)}
/>

<ConfirmModal
	bind:open={showMarkReadyModal}
	title="Marcar lista para revisar"
	message={markReadyMessage}
	confirmLabel="Marcar lista"
	confirmColor="yellow"
	loading={actionLoading}
	onConfirm={onMarkReady}
	onCancel={() => (showMarkReadyModal = false)}
/>

<ConfirmModal
	bind:open={showUnmarkReadyModal}
	title="Volver a borrador"
	message={unmarkReadyMessage}
	confirmLabel="Sí, volver a borrador"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={onUnmarkReady}
	onCancel={() => (showUnmarkReadyModal = false)}
/>

<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Orden de Compra"
	message="¿Está seguro de cancelar esta orden de compra? Esta acción no se puede deshacer."
	confirmLabel="Cancelar Orden"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={onCancel}
	onCancel={() => (showCancelModal = false)}
/>

<PriceSuggestionModal
	bind:open={showPriceSuggestionModal}
	suggestions={priceSuggestions}
	loading={priceLoading}
	onApply={onApplyPrices}
	onSkip={onSkipPrices}
/>

<ConfirmModal
	bind:open={showRevertModal}
	title="Deshacer recepción del lote"
	message={revertTarget
		? `¿Está seguro de deshacer la recepción del lote de "${revertTarget.productName}" (${revertTarget.quantity} unidades)? Esto vaciará el lote y reducirá el stock disponible del artículo.`
		: ''}
	confirmLabel="Deshacer recepción"
	confirmColor="red"
	loading={revertLoading}
	onConfirm={onRevertLot}
	onCancel={onRevertCancel}
/>
