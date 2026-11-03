<script lang="ts">
	import { ChevronDown, Plus } from '@lucide/svelte';
	import DocumentItemRow from '$lib/components/commercialDocument/DocumentItemRow.svelte';
	import DocumentChildRow from '$lib/components/commercialDocument/DocumentChildRow.svelte';
	import { formatPrice } from '$lib/utils';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		rxRowLine,
		type DocumentChildView,
		type DocumentItemView
	} from '$lib/components/commercialDocument/itemView';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { getCachedLensItem } from '../catalogCache.svelte';
	import { ADD_ITEM_KINDS, type AddItemKind } from './addItemKinds';
	import type { EditableItem } from '../editSaleDraft';

	interface Props {
		activeItems: EditableItem[];
		mainItems: EditableItem[];
		/** Playing the staggered entrance after returning from the item view. */
		stagger: boolean;
		saving: boolean;
		rangeWarnings?: Record<string, string[]>;
		onToggleEditor: (item: EditableItem, focusTreatments?: boolean) => void;
		onRemove: (item: EditableItem) => void;
		onRestore: (item: EditableItem) => void;
		onAdd: (kind: AddItemKind) => void;
		onRemoveChild: (child: EditableItem) => void;
	}

	let {
		activeItems,
		mainItems,
		stagger,
		saving,
		rangeWarnings = {},
		onToggleEditor,
		onRemove,
		onRestore,
		onAdd,
		onRemoveChild
	}: Props = $props();

	let menuOpen = $state(false);
	let menuRoot = $state<HTMLElement>();

	// ── View-model mapping ──────────────────────────────────────────────────
	const FACTORY_TREATMENTS = (lens: ReturnType<typeof getCachedLensItem>): string[] => {
		if (!lens) return [];
		const parts: string[] = [];
		if (lens.hasAr) parts.push('Antirreflejo');
		if (lens.hasBluecut) parts.push('Blue Block');
		if (lens.isPhotochromic) parts.push('Fotocromático');
		return parts;
	};

	function kindFor(item: EditableItem): DocumentItemView['kind'] {
		if (item.itemType === SaleItemType.LENS_PAIR) return 'crystal';
		if (item.itemType === SaleItemType.FREE_ITEM) return 'free';
		return 'product';
	}

	function hasRx(item: EditableItem, eye: 'od' | 'os'): boolean {
		const fields =
			eye === 'od'
				? [item.odSphere, item.odCylinder, item.odAxis, item.odAddition]
				: [item.osSphere, item.osCylinder, item.osAxis, item.osAddition];
		return fields.some((value) => value != null);
	}

	function eyeLine(item: EditableItem, label: 'OD' | 'OI', eye: 'od' | 'os'): string {
		return rxRowLine(label, !hasRx(item, eye), {
			sphere: eye === 'od' ? item.odSphere : item.osSphere,
			cylinder: eye === 'od' ? item.odCylinder : item.osCylinder,
			axis: eye === 'od' ? item.odAxis : item.osAxis,
			addition: eye === 'od' ? item.odAddition : item.osAddition
		});
	}

	function subtitleFor(item: EditableItem): string | undefined {
		if (item.itemType === SaleItemType.LENS_PAIR) {
			const factory = item.lensCatalogItemId
				? FACTORY_TREATMENTS(getCachedLensItem(item.lensCatalogItemId))
				: [];
			const parts = [item.snapshotBrand];
			if (factory.length > 0) parts.push(`Incluye ${factory.join(', ')}`);
			return parts.filter(Boolean).join(' · ') || undefined;
		}
		if (item.itemType === SaleItemType.FREE_ITEM) {
			const parts = [item.freeItemCategory, item.freeItemDescription, item.notes];
			const clean = parts.filter((part): part is string => Boolean(part));
			if (item.freeItemDescription && item.freeItemCategory) return clean.join(' · ');
			return clean.join(' · ') || 'Servicio o fórmula';
		}
		return [item.snapshotSku, item.snapshotBrand].filter(Boolean).join(' · ') || undefined;
	}

	function badgesFor(item: EditableItem): DocumentItemView['badges'] {
		const warnings = item.id ? rangeWarnings[item.id] : undefined;
		if (!warnings?.length) return [];
		return [{ label: 'Rango', tone: 'warning', tooltip: warnings.join(' · ') }];
	}

	function toView(item: EditableItem): DocumentItemView {
		const title =
			item.snapshotName ??
			(item.itemType === SaleItemType.FREE_ITEM
				? (item.freeItemDescription ?? 'Nuevo ítem libre')
				: item.itemType === SaleItemType.LENS_PAIR
					? 'Nuevo cristal'
					: 'Nuevo producto');

		// Full prescription per eye (never truncated); collapsed to one line only
		// when neither eye carries values.
		const subtitleLines: string[] = [];
		if (item.itemType === SaleItemType.LENS_PAIR) {
			if (hasRx(item, 'od') || hasRx(item, 'os')) {
				subtitleLines.push(eyeLine(item, 'OD', 'od'));
				subtitleLines.push(eyeLine(item, 'OI', 'os'));
			} else {
				subtitleLines.push('Sin receta');
			}
		}

		return {
			id: item.id ?? '',
			title,
			subtitle: subtitleFor(item),
			subtitleLines,
			kind: kindFor(item),
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			discount: item.discount ?? 0,
			discountType: item.discountType,
			badges: badgesFor(item),
			isNew: !item.id,
			removed: item._removed === true
		};
	}

	// ── Treatment children ───────────────────────────────────────────────────
	/**
	 * Display convention: new rows store qty = eyes with rx and a per-eye
	 * unitPrice; legacy rows store qty=1 with a pair (×2) unitPrice.
	 */
	function childView(child: EditableItem): DocumentChildView | null {
		const perEye = child.quantity > 1 ? child.unitPrice : child.unitPrice / 2;
		const eyes = child.quantity > 1 ? child.quantity : 2;
		if (perEye <= 0) return null;
		const isAr = child.snapshotTreatmentCategory?.toUpperCase() === 'AR';
		return {
			key: child.id ?? child.supplierTreatmentId ?? child.snapshotName ?? 'child',
			title: child.snapshotName ?? 'Tratamiento',
			kind: 'treatment',
			tag: isAr ? 'Antirreflejo' : 'Adicional',
			quantity: eyes,
			unitPrice: perEye,
			unitPriceLabel: `${formatPrice(perEye)} c/u`
		};
	}

	function childItemsOf(item: EditableItem): EditableItem[] {
		if (!item.id || item._removed) return [];
		return activeItems.filter(
			(child) => child.parentSaleItemId === item.id && child.itemType === SaleItemType.TREATMENT
		);
	}

	// ── Add menu ─────────────────────────────────────────────────────────────
	function selectKind(kind: AddItemKind) {
		menuOpen = false;
		onAdd(kind);
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (menuOpen && menuRoot && !menuRoot.contains(event.target as Node)) menuOpen = false;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') menuOpen = false;
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<section class="relative">
	<!-- Live region for remove / restore announcements -->
	<p class="sr-only" aria-live="polite">
		{mainItems.filter((item) => !item._removed).length}
		artículo(s), {mainItems.filter((item) => item._removed).length} quitado(s).
	</p>

	<!-- Sticky section header: count + add menu -->
	<div class="sticky top-0 z-[4] flex items-center gap-2 bg-surface-drawer px-4 pt-3.5 pb-2">
		<h2 class="text-[11px] font-bold tracking-[0.08em] text-brand-navy uppercase">Artículos</h2>
		<span
			class="rounded-[4px] bg-brand-navy px-[7px] text-[12px] font-bold text-white tabular-nums"
		>
			{mainItems.filter((item) => !item._removed).length}
		</span>

		<div class="relative ml-auto" bind:this={menuRoot}>
			{#snippet addTrigger({ props }: { props: Record<string, unknown> })}
				<button
					{...props}
					type="button"
					disabled={saving}
					onclick={() => (menuOpen = !menuOpen)}
					aria-expanded={menuOpen}
					aria-haspopup="menu"
					class="flex h-9 items-center gap-2 rounded-lg bg-brand-navy px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-navy-dark disabled:opacity-50"
				>
					<Plus class="h-3.5 w-3.5" /> Agregar
					<ChevronDown
						class="h-3.5 w-3.5 transition-transform duration-200 {menuOpen ? 'rotate-180' : ''}"
					/>
				</button>
			{/snippet}
			<TriggerTooltip
				text="Agregar un cristal, producto o ítem libre"
				side="bottom"
				trigger={addTrigger}
			/>

			{#if menuOpen}
				<div
					class="absolute top-[calc(100%+6px)] right-0 z-10 w-[310px] rounded-xl bg-white p-1.5 shadow-[0_8px_24px_rgba(21,35,70,0.16),0_24px_56px_rgba(21,35,70,0.22)]"
					role="menu"
				>
					{#each ADD_ITEM_KINDS as option (option.kind)}
						{@const Icon = option.icon}
						<button
							type="button"
							role="menuitem"
							onclick={() => selectKind(option.kind)}
							class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-info-container"
						>
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6ecf4] text-brand-navy"
							>
								<Icon class="h-4 w-4" />
							</span>
							<span class="min-w-0">
								<span class="block text-sm font-semibold text-on-surface">{option.label}</span>
								<span class="block text-[12px] text-on-surface-variant">{option.hint}</span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Rows -->
	{#if mainItems.length === 0}
		<p class="px-4 py-9 text-center text-[13px] text-on-surface-variant">
			Sin artículos todavía — agrega el primero
		</p>
	{:else}
		<div>
			{#each mainItems as item, index (item.id ?? `new-${index}`)}
				<div data-item-id={item.id ?? `new-${index}`} style:--d={index} class:row-in={stagger}>
					<DocumentItemRow
						item={toView(item)}
						onOpen={() => onToggleEditor(item)}
						onRemove={() => onRemove(item)}
						onRestore={() => onRestore(item)}
					/>

					{#each childItemsOf(item) as child, childIndex (child.id)}
						{@const childVm = childView(child)}
						{#if childVm}
							<DocumentChildRow
								child={childVm}
								last={childIndex === childItemsOf(item).length - 1}
								onOpen={() => onToggleEditor(item, true)}
								onRemove={() => onRemoveChild(child)}
							/>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<div class="h-3"></div>
</section>

<style>
	@keyframes row-in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
	.row-in {
		animation: row-in 0.35s cubic-bezier(0.25, 1, 0.5, 1) both;
		animation-delay: calc(var(--d) * 40ms);
	}
	@media (prefers-reduced-motion: reduce) {
		.row-in {
			animation: none;
		}
	}
</style>
