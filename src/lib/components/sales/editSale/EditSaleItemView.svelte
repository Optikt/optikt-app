<script lang="ts">
	/**
	 * Item detail view (fase 3): blue band + the editor cards.
	 * The band owns «Volver» (discard) and «Hecho» (apply to the local basket),
	 * so each editor accepts apply() calls from here via bind:this.
	 */
	import EditSaleItemBand from './EditSaleItemBand.svelte';
	import EditSaleLensEditor from './EditSaleLensEditor.svelte';
	import EditSaleProductEditor from './EditSaleProductEditor.svelte';
	import EditSaleFreeEditor from './EditSaleFreeEditor.svelte';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import type { PrescriptionMeasures } from './editSaleLensAdapter';
	import {
		mapTreatmentsForEdit,
		type EditableItem,
		type EditLensTreatment
	} from '../editSaleDraft';
	import type { EditorKind } from './editSaleViews';

	interface Props {
		item: EditableItem;
		/** Full editable basket (children incl.) — needed to map existing treatments. */
		activeItems: EditableItem[];
		kind: EditorKind;
		creating: boolean;
		treatments: SupplierTreatment[];
		/** Per-eye DP/DNP seed from the sale prescription (edition round-trip). */
		measures?: PrescriptionMeasures;
		onApplyLens: (
			saved: EditableItem,
			treatments: EditLensTreatment[],
			brandName: string | undefined,
			applyInfo?: { measures: PrescriptionMeasures; eyesWithRx: number }
		) => void;
		onCommitProduct: (item: EditableItem) => void;
		onCommitFree: (item: EditableItem) => void;
		onBack: () => void;
	}

	let {
		item,
		activeItems,
		kind,
		creating,
		treatments,
		measures,
		onApplyLens,
		onCommitProduct,
		onCommitFree,
		onBack
	}: Props = $props();

	let lensApi: EditSaleLensEditor | undefined = $state();
	let productApi: EditSaleProductEditor | undefined = $state();
	let freeApi: EditSaleFreeEditor | undefined = $state();

	const title = $derived(
		kind === 'lens' ? 'Cristal' : kind === 'product' ? 'Producto' : 'Ítem libre'
	);
	const isNew = $derived(creating);

	function done() {
		if (kind === 'lens') lensApi?.apply();
		else if (kind === 'product') productApi?.apply();
		else freeApi?.apply();
	}
</script>

<div class="flex min-h-full flex-col bg-surface-drawer">
	<EditSaleItemBand {title} {isNew} {onBack} onDone={done} />

	<div class="flex flex-col gap-3 px-4 pt-3.5 pb-4">
		{#if kind === 'lens'}
			<EditSaleLensEditor
				bind:this={lensApi}
				{item}
				editTreatments={mapTreatmentsForEdit(activeItems, item.id)}
				{treatments}
				{measures}
				onApply={onApplyLens}
			/>
		{:else if kind === 'product'}
			<EditSaleProductEditor
				bind:this={productApi}
				{item}
				mode={creating ? 'add' : 'edit'}
				onCommit={onCommitProduct}
			/>
		{:else}
			<EditSaleFreeEditor bind:this={freeApi} {item} onCommit={onCommitFree} />
		{/if}
	</div>
</div>
