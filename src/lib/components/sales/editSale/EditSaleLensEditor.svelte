<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { LensCatalogSource } from '$lib/shared/enums';
	import ItemSelect from '../ItemSelect.svelte';
	import LensEditorPanel from '$lib/components/documentEditor/LensEditorPanel.svelte';
	import type { LensEditorDraft } from '$lib/components/documentEditor/types';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { getCachedLensItem, getCachedLensItems } from '../catalogCache.svelte';
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
	import { eyesWithRxPair } from '$lib/components/documentEditor/lensEditor';

	interface Props {
		item: EditableItem;
		editTreatments: EditLensTreatment[];
		treatments: SupplierTreatment[];
		/** Per-eye DP/DNP seed from the sale prescription (edition round-trip). */
		measures?: PrescriptionMeasures;
		/** Applies the draft through the parent callback with measures + eyes count. */
		onApply: (
			savedItem: EditableItem,
			treatments: EditLensTreatment[],
			brandName: string | undefined,
			applyInfo?: { measures: PrescriptionMeasures; eyesWithRx: number }
		) => void;
	}

	let { item, editTreatments, treatments, measures, onApply }: Props = $props();

	/** Mount-time snapshot: placeholders always carry a local id, so editing an
	 *  existing item and adding a fresh one both seed through the adapter. */
	const lensBase = untrack(() => ({ ...item }));
	let lensDraft = $state<LensEditorDraft>(
		untrack(() => lensEditorDraftFromEditableItem(item, editTreatments, measures))
	);

	const context = $derived(
		getLensEditContext(
			lensDraft.lensCatalogItemId,
			editTreatmentsFromLensEditor(lensDraft.treatments),
			treatments
		)
	);

	const selectedCatalogLens = $derived(
		lensDraft.lensCatalogItemId ? (getCachedLensItem(lensDraft.lensCatalogItemId) ?? null) : null
	);

	const factoryTreatments = $derived.by(() => {
		const lens = selectedCatalogLens;
		if (!lens) return [];
		const names: string[] = [];
		if (lens.hasAr) names.push('Antirreflejo');
		if (lens.hasBluecut) names.push('Blue Block');
		if (lens.isPhotochromic) names.push('Fotocromático');
		return names;
	});

	const factorySource = $derived.by(() => {
		const lens = selectedCatalogLens;
		if (!lens) return null;
		return lens.source === LensCatalogSource.LAB ? 'tallado' : 'terminado';
	});

	function handleLensSelect(id: string, unitPrice: number) {
		const lenses = getCachedLensItems();
		const previousSupplierId = lenses.find((lens) => lens.id === lensDraft.lensCatalogItemId)
			?.supplier?.id;
		const nextSupplierId = lenses.find((lens) => lens.id === id)?.supplier?.id;
		const supplierChanged = previousSupplierId !== nextSupplierId;

		lensDraft.lensCatalogItemId = id || '';
		if (id && unitPrice > 0) lensDraft.unitPrice = unitPrice;

		if (id && supplierChanged) {
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

	let panelApi: LensEditorPanel | undefined = $state();

	/** Exposed for the item band's «Hecho» button: runs the guarded panel flow. */
	export function apply() {
		panelApi?.requestApply();
	}

	function commitDraft() {
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
			applyInfoFromDraft()
		);
	}

	/** Measures (per-eye DP/DNP) + eyes count carried with the apply. */
	function applyInfoFromDraft() {
		return {
			measures: {
				odDp: lensDraft.od.dp,
				osDp: lensDraft.oi.dp,
				odDnp: lensDraft.od.dnp,
				osDnp: lensDraft.oi.dnp
			} satisfies PrescriptionMeasures,
			eyesWithRx: eyesWithRxPair(lensDraft.od, lensDraft.oi)
		};
	}
</script>

{#snippet lensSelector()}
	<ItemSelect
		kind="lens"
		value={lensDraft.lensCatalogItemId}
		snapshotLabel={lensBase.snapshotName ?? ''}
		onselect={handleLensSelect}
		label="Cristal"
	/>
{/snippet}

<LensEditorPanel
	bind:draft={lensDraft}
	lensType={context.selectedLens?.type ?? ''}
	ranges={context.selectedLens?.ranges ?? []}
	selectableTreatments={context.selectableTreatments.map((treatment) => ({
		id: treatment.id,
		name: treatment.name,
		price: treatment.price,
		salePrice: treatment.salePrice,
		category: treatment.category
	}))}
	{factoryTreatments}
	{factorySource}
	supplierName={context.selectedLens?.supplier?.name}
	{lensSelector}
	onAddTreatment={addTreatment}
	onRemoveTreatment={removeTreatment}
	onApply={commitDraft}
/>
