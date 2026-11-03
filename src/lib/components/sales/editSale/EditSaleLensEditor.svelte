<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ItemSelect from '../ItemSelect.svelte';
	import LensEditorPanel from '$lib/components/documentEditor/LensEditorPanel.svelte';
	import { createEmptyLensEditorDraft } from '$lib/components/documentEditor/lensEditor';
	import type { LensEditorDraft } from '$lib/components/documentEditor/types';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { getCachedLensItems } from '../catalogCache.svelte';
	import {
		buildLensInputFromDraft,
		getLensEditContext,
		type EditableItem,
		type EditLensTreatment
	} from '../editSaleDraft';
	import {
		editTreatmentsFromLensEditor,
		filterCompatibleTreatments,
		lensEditorDraftFromEditableItem,
		type PrescriptionMeasures
	} from './editSaleLensAdapter';

	interface Props {
		item: EditableItem;
		mode: 'add' | 'edit';
		editTreatments: EditLensTreatment[];
		treatments: SupplierTreatment[];
		/** Per-eye DP/DNP seed from the sale prescription (edition round-trip). */
		measures?: PrescriptionMeasures;
		/** Applies the draft through the parent callback with the measures snapshot. */
		onApply: (
			savedItem: EditableItem,
			treatments: EditLensTreatment[],
			brandName: string | undefined,
			measures?: PrescriptionMeasures
		) => void;
	}

	let { item, mode, editTreatments, treatments, measures, onApply }: Props = $props();

	const lensBase = untrack(() => ({ ...item }));
	let lensDraft = $state<LensEditorDraft>(
		untrack(() =>
			item.id
				? lensEditorDraftFromEditableItem(item, editTreatments, measures)
				: createEmptyLensEditorDraft()
		)
	);

	const context = $derived(
		getLensEditContext(
			lensDraft.lensCatalogItemId,
			editTreatmentsFromLensEditor(lensDraft.treatments),
			treatments
		)
	);

	function handleLensSelect(id: string, unitPrice: number) {
		const lenses = getCachedLensItems();
		const previousSupplierId = lenses.find((lens) => lens.id === lensDraft.lensCatalogItemId)
			?.supplier?.id;
		const nextSupplierId = lenses.find((lens) => lens.id === id)?.supplier?.id;
		const supplierChanged = previousSupplierId !== nextSupplierId;

		lensDraft.lensCatalogItemId = id || '';
		if (id && unitPrice > 0) lensDraft.unitPrice = unitPrice;

		if (id && (supplierChanged || !item.id)) {
			if (lensDraft.treatments.length > 0) {
				toast.warning('Se quitaron los tratamientos porque pertenecen a otro proveedor');
			}
			lensDraft.treatments = [];
		}
	}

	function addTreatment(treatmentId: string) {
		if (!treatmentId) return;
		const treatment = context.availableTreatments.find((candidate) => candidate.id === treatmentId);
		if (!treatment) return;
		const salePrice = treatment.salePrice ?? treatment.price;
		lensDraft.treatments = [
			...lensDraft.treatments,
			{
				supplierTreatmentId: treatment.id,
				name: treatment.name,
				price: treatment.price,
				salePrice,
				isTaxable: treatment.isTaxable,
				category: treatment.category
			}
		];
	}

	function removeTreatment(index: number) {
		lensDraft.treatments = lensDraft.treatments.filter((_, current) => current !== index);
	}

	/** Exposed for the item band's «Hecho» button (item detail view). */
	export function apply() {
		if (!lensDraft.lensCatalogItemId) return;

		const sellerId = context.selectedLens?.supplier?.id;
		const compatible = filterCompatibleTreatments(
			lensDraft.treatments,
			context.availableTreatments,
			!!sellerId
		);
		if (compatible.length !== lensDraft.treatments.length) {
			toast.warning('Se omitieron tratamientos que no pertenecen al proveedor del cristal');
		}

		const baseItem = { ...lensBase, id: item.id || crypto.randomUUID() };
		const savedItem = buildLensInputFromDraft(baseItem, context.selectedLens);
		onApply(
			savedItem,
			editTreatmentsFromLensEditor(compatible),
			context.selectedLens?.supplier?.name ?? lensBase.snapshotBrand,
			measuresFromDraft()
		);
	}

	/** Measures snapshot (per-eye DP/DNP) carried for the payload patch. */
	function measuresFromDraft(): PrescriptionMeasures {
		return {
			odDp: lensDraft.od.dp,
			osDp: lensDraft.oi.dp,
			odDnp: lensDraft.od.dnp,
			osDnp: lensDraft.oi.dnp
		};
	}
</script>

{#snippet lensSelector()}
	<ItemSelect
		kind="lens"
		value={lensDraft.lensCatalogItemId}
		onselect={handleLensSelect}
		label="Cristal"
	/>
{/snippet}

<LensEditorPanel
	{mode}
	bind:draft={lensDraft}
	lensType={context.selectedLens?.type ?? ''}
	ranges={context.selectedLens?.ranges ?? []}
	selectableTreatments={context.selectableTreatments}
	{lensSelector}
	onAddTreatment={addTreatment}
	onRemoveTreatment={removeTreatment}
	onApply={apply}
	showHeader={false}
/>
