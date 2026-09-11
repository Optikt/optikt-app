<script lang="ts" module>
	export interface CountLineEditing {
		lineId: number | null;
		count: string;
		notes: string;
		showNotes: boolean;
		isSaving: boolean;
	}

	export function createEmptyLineEditing(): CountLineEditing {
		return { lineId: null, count: '', notes: '', showNotes: false, isSaving: false };
	}

	export function startLineEditing(line: {
		id: number;
		countedStock: number | null;
		notes: string | null;
	}): CountLineEditing {
		return {
			lineId: line.id,
			count: line.countedStock !== null ? String(line.countedStock) : '',
			notes: line.notes ?? '',
			showNotes: Boolean(line.notes),
			isSaving: false
		};
	}
</script>

<script lang="ts">
	import { Check } from '@lucide/svelte';

	interface Props {
		layout: 'desktop' | 'mobile';
		count: string;
		notes?: string;
		showNotes?: boolean;
		isSaving: boolean;
		onSave: () => void;
		onCancel: () => void;
	}

	let {
		layout,
		count = $bindable(),
		notes = $bindable(''),
		showNotes = $bindable(false),
		isSaving,
		onSave,
		onCancel
	}: Props = $props();
</script>

{#if layout === 'desktop'}
	<div class="ml-auto flex max-w-[12rem] flex-col items-end gap-1.5">
		<div class="flex items-center gap-2">
			<input
				type="number"
				bind:value={count}
				min="0"
				class="w-20 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-right text-sm text-on-surface"
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						onSave();
					}
					if (event.key === 'Escape') {
						event.preventDefault();
						onCancel();
					}
				}}
			/>
			<button
				type="button"
				onclick={onSave}
				disabled={isSaving}
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
			>
				<Check class="h-4 w-4" />
			</button>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => (showNotes = !showNotes)}
				class="text-[11px] font-semibold text-brand-blue transition-colors hover:text-brand-navy"
			>
				{showNotes ? 'Ocultar nota' : 'Agregar nota'}
			</button>
		</div>

		{#if showNotes}
			<textarea
				bind:value={notes}
				rows="2"
				class="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface"
				placeholder="Nota opcional"></textarea>
		{/if}
	</div>
{:else}
	<div class="mt-1 flex items-center gap-2">
		<input
			type="number"
			bind:value={count}
			min="0"
			class="w-20 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-right text-sm text-on-surface"
		/>
		<button
			type="button"
			onclick={onSave}
			disabled={isSaving}
			class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
		>
			<Check class="h-4 w-4" />
		</button>
	</div>
{/if}
