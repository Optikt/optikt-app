<script lang="ts">
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import EditSaleDiscardConfirm from './editSale/EditSaleDiscardConfirm.svelte';
	import { toast } from 'svelte-sonner';
	import { DiscountType } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import type {
		QuoteItemWithDetails,
		QuoteWithRelations
	} from '$lib/server/db/queries/quotes/types';
	import type { SupplierTreatment, Prescription } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import EditSaleItemView from './editSale/EditSaleItemView.svelte';
	import { fromISO } from '$lib/dates';
	import { businessDateISO } from '$lib/shared/quotes/quoteValidity';
	import { getCachedLensItem } from './catalogCache.svelte';
	import EditSaleMetaBar from './editSale/EditSaleMetaBar.svelte';
	import EditSaleItemsList from './editSale/EditSaleItemsList.svelte';
	import { editorKindFor, type EditorKind } from './editSale/editSaleViews';
	import EditSaleFooter from './editSale/EditSaleFooter.svelte';
	import EditSaleModalHeader from './editSale/EditSaleModalHeader.svelte';
	import { createPlaceholder, type AddItemKind } from './editSale/addItemKinds';
	import {
		applyLensEdit,
		existingItemToInput,
		hasChangesForSale,
		previewSubtotalForItems,
		type EditableItem,
		type EditLensTreatment
	} from './editSaleDraft';
	import { collectLensRangeWarnings } from './editSale/editSaleLensAdapter';
	import {
		quoteHasChanges,
		quoteItemToEditable
	} from '$lib/components/quotes/editQuote/quoteEditAdapter';
	import { formatQuoteNumber } from '$lib/components/quotes/list/quoteListDisplay';
	import { buildEditSubmitInput, submitEditSale } from './editSale/submitEditSale';
	import {
		EMPTY_MEASURES,
		measuresChanged,
		measuresFromSeed,
		removeEditableChild,
		removeEditableItem,
		restoreEditableItem,
		seedCatalogCacheLogged,
		validateEditModal,
		type Measures
	} from './editSale/editSaleModalHelpers';
	import EditSalePersonsTab from './editSale/EditSalePersonsTab.svelte';
	import { EditPersons } from './groups/editPersons.svelte';
	import type { ItemGroup } from '$lib/shared/saleItemGroups';
	interface Props {
		open: boolean;
		sale?: SaleWithRelations;
		items?: SaleItemWithDetails[];
		treatments: SupplierTreatment[];
		/** Sale prescription row (DP / nasal measures source for lens pairs). */
		prescription?: Prescription | null;
		/** Adapter quote (D1): mutually exclusive with `sale`. */
		quote?: QuoteWithRelations;
		quoteItems?: QuoteItemWithDetails[];
		/** Current per-person groups of the sale/quote. */
		itemGroups?: ItemGroup[];
		onSuccess?: () => void;
	}

	let {
		open = $bindable(),
		sale,
		items = [],
		treatments = [],
		prescription = null,
		quote,
		quoteItems = [],
		itemGroups = [],
		onSuccess
	}: Props = $props();

	/** Modo del drawer: 'sale' (default, cero regresión) | 'quote'. */
	const mode = $derived(quote ? 'quote' : 'sale');

	let saving = $state(false);
	let submitError = $state('');
	let confirmDiscard = $state(false);

	// Measures de montaje (solo ventas) — helpers puros.
	const seedMeasures = $derived(
		prescription
			? { dp: prescription.dp, npRight: prescription.npRight, npLeft: prescription.npLeft }
			: null
	);
	let measures = $state<Measures>(untrack(() => measuresFromSeed(seedMeasures)));
	const measuresChangedNow = $derived(
		mode === 'quote' ? false : measuresChanged(measures, seedMeasures)
	);

	let saleDate = $state('');
	let notes = $state('');
	let isCashea = $state(false);
	/** Solo quotes: validez editable ('' = sin vencimiento). */
	let validUntil = $state('');

	let discount = $state(0);
	let discountType = $state<string>(DiscountType.FIXED);

	let reason = $state('');
	let reasonError = $state('');

	$effect(() => {
		if (reason) reasonError = '';
	});

	let editableItems = $state<EditableItem[]>([]);

	// ── Per-person grouping (Personas tab) ─────────────────────────────
	const persons = new EditPersons(() => ({
		mode,
		docLabel:
			mode === 'quote' && quote
				? formatQuoteNumber(quote.quoteNumber)
				: sale
					? `#${String(sale.orderNumber).padStart(4, '0')}`
					: undefined,
		editable: editableItems,
		lines: [...items, ...quoteItems]
	}));
	let editingId = $state<string | null>(null);
	let editorKind = $state<EditorKind | null>(null);
	let creating = $state(false);
	/** Two views inside the body: the list and the open item editor. */
	let view = $state<'list' | 'editor'>('list');
	let staggerRows = $state(false);
	let staggerTimer: ReturnType<typeof setTimeout> | undefined;

	function backToList() {
		view = 'list';

		staggerRows = true;
		clearTimeout(staggerTimer);
		staggerTimer = setTimeout(() => (staggerRows = false), 420);
	}

	function inFly(node: HTMLElement) {
		return view === 'list'
			? fly(node, { x: -28, duration: 280, easing: cubicOut })
			: fly(node, { x: 28, duration: 280, easing: cubicOut });
	}

	let originalQuoteItems = $state<QuoteItemWithDetails[]>([]);
	let quoteChanges = $derived.by(() => {
		if (mode !== 'quote' || !quote) return { changed: false, itemsChanged: false };
		return quoteHasChanges(quote, originalQuoteItems, {
			dateIso: saleDate,
			validUntilIso: validUntil,
			notes,
			isCashea,
			discount,
			discountType,
			items: editableItems
		});
	});

	let hasChanges = $derived.by(() => {
		if (persons.changed) return true;
		if (mode === 'quote') return quoteChanges.changed;
		return (
			hasChangesForSale(
				sale!,
				saleDate,
				notes,
				discount,
				discountType,
				isCashea,
				editableItems,
				items
			) || measuresChangedNow
		);
	});
	let activeItems = $derived(editableItems.filter((item) => !item._removed));
	let mainItems = $derived(activeItems.filter((item) => item.itemType !== SaleItemType.TREATMENT));
	let removedCount = $derived(editableItems.filter((item) => item._removed).length);
	let previewTotals = $derived(previewSubtotalForItems(activeItems, discount, discountType));
	let previewSubtotal = $derived(previewTotals.subtotal);
	let previewGlobalDiscount = $derived(previewTotals.globalDiscount);
	let previewTotal = $derived(previewTotals.total);
	let lensRangeWarnings = $derived(collectLensRangeWarnings(activeItems, getCachedLensItem));

	function seedFromProps() {
		submitError = '';
		confirmDiscard = false;
		editingId = null;
		editorKind = null;
		creating = false;
		view = 'list';
		staggerRows = false;
		persons.seed(itemGroups, sale?.primaryLensItemId ?? null);

		if (mode === 'quote' && quote) {
			// quoteDate (no createdAt): fecha editable del presupuesto, en día de negocio.
			saleDate = businessDateISO(quote.quoteDate);
			validUntil = quote.validUntil ? quote.validUntil.slice(0, 10) : '';
			notes = quote.notes ?? '';
			isCashea = quote.isCashea ?? false;
			discount = quote.discount;
			discountType = quote.discountType;
			reason = '';
			reasonError = '';
			editableItems = quoteItems.map(quoteItemToEditable);
			originalQuoteItems = quoteItems;
			measures = { ...EMPTY_MEASURES };
			seedCatalogCacheLogged(quoteItems, 'quote');
			return;
		}

		saleDate = sale ? fromISO(sale.saleDate).toISOString().slice(0, 10) : '';
		notes = sale?.notes ?? '';
		isCashea = sale?.isCashea ?? false;
		discount = sale?.discount ?? 0;
		discountType = sale?.discountType ?? DiscountType.FIXED;
		reason = '';
		reasonError = '';
		editableItems = items.map(existingItemToInput);
		measures = measuresFromSeed(seedMeasures);
		seedCatalogCacheLogged(items, 'sale');
	}

	$effect(() => {
		if (!open) return;
		untrack(() => seedFromProps());
	});

	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	function closeEditor() {
		if (creating && editingId) {
			const id = editingId;
			editableItems = editableItems.filter(
				(item) => item.id !== id && item.parentSaleItemId !== id
			);
		}
		finishEditing();
	}

	function startAdd(kind: AddItemKind) {
		closeEditor();
		const placeholder = createPlaceholder(kind);
		editableItems = [...editableItems, placeholder];
		editingId = placeholder.id ?? null;
		editorKind = kind;
		creating = true;
		view = 'editor';
	}

	function toggleEditor(item: EditableItem, _focusTreatments = false) {
		if (editingId === item.id) {
			closeEditor();
			return;
		}
		closeEditor();
		if (!item.id) return;
		editingId = item.id;
		editorKind = editorKindFor(item);
		creating = false;
		view = 'editor';
	}

	function finishEditing() {
		editingId = null;
		editorKind = null;
		creating = false;
		view = 'list';
		staggerRows = false;
	}

	function handleApplyLens(
		savedItem: EditableItem,
		editTreatments: EditLensTreatment[],
		brandName: string | undefined,
		applyInfo?: { measures: Measures; eyesWithRx: number }
	) {
		const wasNew = creating;
		if (applyInfo) measures = applyInfo.measures;
		editableItems = applyLensEdit(
			editableItems,
			editingId,
			savedItem,
			editTreatments,
			brandName,
			applyInfo?.eyesWithRx ?? 2
		);
		finishEditing();
		toast.success(wasNew ? 'Cristal agregado' : 'Cristal actualizado');
	}

	function commitSimpleItem(updated: EditableItem, noun: string) {
		const wasNew = creating;
		editableItems = editableItems.map((item) => (item.id === updated.id ? updated : item));
		finishEditing();
		toast.success(`${noun} ${wasNew ? 'agregado' : 'actualizado'}`);
	}

	const handleCommitProduct = (updated: EditableItem) => commitSimpleItem(updated, 'Producto');
	const handleCommitFree = (updated: EditableItem) => commitSimpleItem(updated, 'Ítem libre');

	function removeItem(item: EditableItem) {
		editableItems = removeEditableItem(editableItems, item);
		if (item.id && editingId === item.id) {
			creating = false;
			editingId = null;
			editorKind = null;
			backToList();
		}
	}

	function restoreItem(item: EditableItem) {
		editableItems = restoreEditableItem(editableItems, item);
	}

	function removeChild(child: EditableItem) {
		editableItems = removeEditableChild(editableItems, child);
	}

	function validate(): boolean {
		const result = validateEditModal({
			editingId,
			mode,
			activeItems,
			reason
		});
		reasonError = result.reasonError;
		return result.valid;
	}

	async function handleSubmit(skipReorganizeCheck = false) {
		submitError = '';
		if (!validate()) return;
		if (!skipReorganizeCheck && persons.needsReorganizeConfirm) {
			persons.confirmReorganize = true;
			return;
		}
		saving = true;
		try {
			const error = await submitEditSale(
				buildEditSubmitInput({
					quote: mode === 'quote' ? quote : undefined,
					sale,
					items,
					editableItems,
					activeItems,
					removedCount,
					saleDate,
					validUntil,
					notes,
					isCashea,
					discount,
					discountType,
					reason,
					prescription,
					measures,
					groupsPatch: persons.patch()
				})
			);
			submitError = error ?? '';
			if (error === null) {
				confirmDiscard = false;
				open = false;
				onSuccess?.();
			}
		} finally {
			saving = false;
		}
	}

	function guardClose(): boolean {
		if (saving) return false;
		if (!hasChanges) return true;
		confirmDiscard = true;
		return false;
	}

	function discardAndClose() {
		confirmDiscard = false;
		open = false;
	}
</script>

<SlideOver
	bind:open
	size="xl"
	closeGuard={guardClose}
	escapeHandler={() => {
		if (view === 'editor') {
			closeEditor();
			return true;
		}
		return false;
	}}
	widthClass="w-full lg:w-[clamp(720px,60vw,920px)]"
	bodyClass="p-0 bg-surface-drawer"
>
	{#snippet header({ onclose })}
		{#if mode === 'quote' && quote}
			<EditSaleModalHeader
				orderNumber={0}
				numberLabel={formatQuoteNumber(quote.quoteNumber)}
				title="Modificar presupuesto"
				entityNoun="presupuesto"
				customer={quote.customer}
				bind:isCashea
				{saving}
				onClose={onclose}
			/>
			{#if view === 'list'}
				<EditSaleMetaBar bind:saleDate bind:notes bind:validUntil showValidUntil={true} />
			{/if}
		{:else if sale}
			<EditSaleModalHeader
				orderNumber={sale.orderNumber}
				customer={sale.customer}
				bind:isCashea
				{saving}
				onClose={onclose}
			/>
			{#if view === 'list'}
				<EditSaleMetaBar bind:saleDate bind:notes />
			{/if}
		{/if}
	{/snippet}

	{#key view}
		{#if view === 'list' && persons.tab === 'persons'}
			<EditSalePersonsTab {persons} />
		{:else if view === 'list'}
			<div transition:inFly>
				<EditSaleItemsList
					{activeItems}
					{mainItems}
					{saving}
					stagger={staggerRows}
					rangeWarnings={lensRangeWarnings}
					onToggleEditor={toggleEditor}
					onRemove={removeItem}
					onRestore={restoreItem}
					onAdd={startAdd}
					onRemoveChild={removeChild}
					{persons}
				/>
			</div>
		{:else}
			{@const editing = editableItems.find((item) => item.id === editingId)}
			{#if editing}
				<EditSaleItemView
					item={editing}
					{activeItems}
					kind={editorKind ?? 'lens'}
					{creating}
					{treatments}
					onApplyLens={handleApplyLens}
					onCommitProduct={handleCommitProduct}
					onCommitFree={handleCommitFree}
					onBack={closeEditor}
				/>
			{/if}
		{/if}
	{/key}

	{#snippet footer()}
		<EditSaleFooter
			subtotal={previewSubtotal}
			orderDiscountAmount={previewGlobalDiscount}
			total={previewTotal}
			bind:discount
			bind:discountType
			bind:reason
			{reasonError}
			{submitError}
			{saving}
			{hasChanges}
			hasItems={activeItems.length > 0}
			editing={view === 'editor'}
			requireReason={mode === 'sale'}
			saveTooltipOverride={mode === 'quote' ? 'Guardar los cambios del presupuesto' : undefined}
			onClose={() => {
				if (guardClose()) open = false;
			}}
			onSubmit={handleSubmit}
		/>
	{/snippet}
</SlideOver>

<EditSaleDiscardConfirm
	bind:open={confirmDiscard}
	{mode}
	{persons}
	{saving}
	onConfirm={discardAndClose}
	onCancel={() => (confirmDiscard = false)}
	onConfirmReorganize={() => void handleSubmit(true)}
/>
