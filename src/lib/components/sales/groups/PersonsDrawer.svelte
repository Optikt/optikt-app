<script lang="ts">
	import { X } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import { defaultPrimaryLens } from '$lib/shared/saleItemGroups';
	import PersonsEditor from './PersonsEditor.svelte';
	import { primaryNote } from './primaryNote';
	import { toSubmitGroups, type GroupItemView, type UiGroup } from './groupsState';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** "#0313" / "P-0019" chip next to the title and prefix for person codes. */
		docLabel?: string;
		items: GroupItemView[];
		groups: UiGroup[];
		onchange: (groups: UiGroup[]) => void;
		/** Optional transform applied inside the wizard draft (e.g. accessories following frame). */
		transformGroups?: (prev: UiGroup[], next: UiGroup[]) => UiGroup[];
		/** Optional warning banner inside the editor (e.g. persisted groups already have codes). */
		warningMessage?: string;
		showPrimary?: boolean;
		primaryLensId?: string | null;
		/** True while the incoming primary is automatic (not explicitly locked by the user). */
		primaryAuto?: boolean;
		onprimarychange?: (lensId: string | null) => void;
		/** Wizard "Listo": commits draft groups (+ explicit primary when touched) and reorders. */
		oncommit?: (groups: UiGroup[], primaryLensId?: string | null) => void;
		/** Detail "Organizar": persist on "Guardar". Without it, edits a local draft until "Listo". */
		onsave?: () => void;
		saving?: boolean;
		/** Bottom sheet with 44px targets (mobile detail). */
		sheet?: boolean;
		/** Return true to consume Escape (e.g. when a confirmation modal sits above the drawer). */
		escapeHandler?: () => boolean;
	}

	let {
		open = $bindable(),
		onclose,
		docLabel,
		items,
		groups,
		onchange,
		transformGroups,
		warningMessage,
		showPrimary = false,
		primaryLensId = null,
		primaryAuto = false,
		onprimarychange,
		oncommit,
		onsave,
		saving = false,
		sheet = false,
		escapeHandler
	}: Props = $props();

	/**
	 * In wizard mode (no `onsave`), edits stay in a local draft so closing with
	 * X / Esc / Cancelar discards changes, and "Listo" commits & closes cleanly.
	 * In persisted mode (`onsave`), the caller (`GroupsOrganizer`) owns the draft.
	 */
	const draftMode = $derived(!onsave);
	let draftGroups = $state<UiGroup[]>([]);
	let draftPrimary = $state<string | null>(null);
	let primaryTouched = $state(false);
	let wasOpen = false;

	function cloneUiGroups(source: readonly UiGroup[]): UiGroup[] {
		return source.map((g) => ({
			key: g.key,
			label: g.label,
			members: g.members.map((m) => ({ ...m }))
		}));
	}

	$effect.pre(() => {
		if (open && !wasOpen && draftMode) {
			draftGroups = cloneUiGroups(groups);
			draftPrimary = primaryLensId;
			primaryTouched = false;
		}
		wasOpen = open;
	});

	const activeGroups = $derived(draftMode ? draftGroups : groups);
	const activePrimary = $derived(
		draftMode
			? !primaryTouched && primaryAuto
				? defaultPrimaryLens(items, toSubmitGroups(draftGroups))
				: draftPrimary
			: primaryLensId
	);

	function handleGroupsChange(next: UiGroup[]) {
		if (draftMode) {
			draftGroups = transformGroups ? transformGroups(draftGroups, next) : next;
		} else {
			onchange(next);
		}
	}

	function handlePrimaryChange(lensId: string | null) {
		if (draftMode) {
			draftPrimary = lensId;
			primaryTouched = true;
		} else {
			onprimarychange?.(lensId);
		}
	}

	function handleCancel() {
		if (saving) return;
		open = false;
		if (!draftMode) onclose();
	}

	function handlePrimaryAction() {
		if (saving) return;
		if (onsave) {
			onsave();
			return;
		}
		if (oncommit) {
			oncommit(draftGroups, primaryTouched ? draftPrimary : undefined);
			open = false;
			return;
		}
		onchange(draftGroups);
		if (primaryTouched) onprimarychange?.(draftPrimary);
		open = false;
		onclose();
	}

	const note = $derived(
		showPrimary
			? primaryNote(items, activeGroups, activePrimary)
			: 'Agrupa cada ítem con la persona que lo usará. No cambia precios.'
	);
</script>

<SlideOver
	bind:open
	onclose={draftMode ? undefined : onclose}
	closeGuard={() => !saving}
	{escapeHandler}
	direction={sheet ? 'bottom' : 'right'}
	dragClose={sheet}
	widthClass="w-full max-w-[600px]"
	bodyClass="bg-[#edf1f6] px-4 py-3.5 sm:px-[18px]"
>
	{#snippet header({ onclose: close })}
		<header
			class="relative flex items-start gap-3 overflow-hidden bg-brand-navy px-[18px] py-3.5 text-white"
		>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute -top-5 right-[90px] h-[120px] w-[18px] -skew-x-[25deg] bg-brand-gold"
			></span>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute -top-5 right-[60px] h-[120px] w-7 -skew-x-[25deg] bg-brand-blue"
			></span>
			<div class="relative z-[1] flex min-w-0 flex-1 flex-col gap-0.5">
				<h2 class="font-heading text-lg font-bold">
					Personas
					{#if docLabel}
						<span
							class="ml-1 rounded bg-brand-blue px-1.5 py-0.5 align-middle font-mono text-[11px]"
							>{docLabel}</span
						>
					{/if}
				</h2>
				<p class="text-xs text-[#b8c4de]">
					Agrupa cada ítem con la persona que lo usará. No cambia precios.
				</p>
			</div>
			<button
				type="button"
				onclick={close}
				aria-label="Cerrar"
				class="relative z-[1] inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/30 transition-colors hover:bg-white/25 sm:h-[34px] sm:w-[34px]"
			>
				<X class="h-4 w-4" />
			</button>
		</header>
	{/snippet}

	<PersonsEditor
		{items}
		groups={activeGroups}
		onchange={handleGroupsChange}
		{docLabel}
		{warningMessage}
		{showPrimary}
		primaryLensId={activePrimary}
		onprimarychange={handlePrimaryChange}
		touch={sheet}
	/>

	{#snippet footer()}
		<footer class="flex items-center gap-2.5 bg-brand-navy px-[18px] py-3 text-white">
			<p class="min-w-0 flex-1 text-xs text-[#d4eef8]">{note}</p>
			<button
				type="button"
				aria-disabled={saving}
				onclick={handleCancel}
				class="h-11 shrink-0 rounded-lg border border-white/25 bg-white/10 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 aria-disabled:opacity-50 sm:h-[38px]"
			>
				Cancelar
			</button>
			<button
				type="button"
				aria-disabled={saving}
				onclick={handlePrimaryAction}
				class="h-11 shrink-0 rounded-lg bg-brand-gold px-4 text-sm font-bold text-brand-navy transition-colors hover:brightness-95 aria-disabled:opacity-60 sm:h-[38px]"
			>
				{onsave ? (saving ? 'Guardando…' : 'Guardar') : 'Listo'}
			</button>
		</footer>
	{/snippet}
</SlideOver>
