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
	import { logger } from '$lib/utils/logger';
	import { toast } from 'svelte-sonner';

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

	/** Blocking messages pushed up by whichever editor is mounted: drives the
	 *  band's «Hecho» tooltip so hover lists what's missing. */
	let missing = $state<string[]>([]);

	const title = $derived(
		kind === 'lens' ? 'Cristal' : kind === 'product' ? 'Producto' : 'Ítem libre'
	);
	const isNew = $derived(creating);

	function done() {
		const api = kind === 'lens' ? lensApi : kind === 'product' ? productApi : freeApi;
		if (!api) {
			// El editor no montó: «Hecho» no debe caer en un nulo silencioso.
			logger.error(`Editor ${kind} sin bind:this: «Hecho» no puede aplicar`);
			toast.error('No se pudo aplicar el borrador: cierra y reabre el editor');
			return;
		}
		api.apply();
	}
</script>

<div class="flex min-h-full flex-col bg-surface-drawer">
	<EditSaleItemBand {title} {isNew} {onBack} onDone={done} {missing} />

	<div class="flex flex-col gap-3 px-4 pt-3.5 pb-4">
		{#if kind === 'lens'}
			<EditSaleLensEditor
				bind:this={lensApi}
				{item}
				editTreatments={mapTreatmentsForEdit(activeItems, item.id)}
				{treatments}
				{measures}
				onApply={onApplyLens}
				onMissing={(labels) => (missing = labels)}
			/>
		{:else if kind === 'product'}
			<EditSaleProductEditor
				bind:this={productApi}
				{item}
				mode={creating ? 'add' : 'edit'}
				onCommit={onCommitProduct}
				onMissing={(labels) => (missing = labels)}
			/>
		{:else}
			<EditSaleFreeEditor
				bind:this={freeApi}
				{item}
				onCommit={onCommitFree}
				onMissing={(labels) => (missing = labels)}
			/>
		{/if}
	</div>
</div>
