<script lang="ts">
	import { groupCode, groupDisplayLabel, type ItemGroup } from '$lib/shared/saleItemGroups';
	import PersonAvatar from '$lib/components/sales/groups/PersonAvatar.svelte';
	import type { GroupItemView } from '$lib/components/sales/groups/groupsState';

	/**
	 * Conversion: persons pass as-is to the sale; the customer's prescription is
	 * chosen here (one lens or "Ninguna" — nothing is created/overwritten).
	 */
	interface Props {
		items: GroupItemView[];
		groups: ItemGroup[];
		primary: string | null;
		docLabel?: string;
		onprimarychange: (lensId: string | null) => void;
	}

	let { items, groups, primary, docLabel, onprimarychange }: Props = $props();

	const lenses = $derived(items.filter((i) => i.itemType === 'LENS_PAIR'));
	const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? 'Artículo';

	function ownerOf(lensId: string): string | null {
		const index = groups.findIndex((g) => g.members.some((m) => m.itemId === lensId));
		return index >= 0 ? groupDisplayLabel(groups[index].label, index) : null;
	}
</script>

<div class="flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-sm">
	{#if groups.length > 0}
		<section aria-label="Personas">
			<p class="text-[11px] font-bold tracking-[0.1em] text-on-surface uppercase">
				Personas <span class="font-medium tracking-normal normal-case"
					>· pasan tal cual a la venta</span
				>
			</p>
			<ul class="mt-1.5 flex flex-col gap-1.5 text-[13px]">
				{#each groups as group, index (index)}
					{@const code = groupCode(docLabel, index)}
					<li class="flex items-center gap-2 text-sm">
						<PersonAvatar label={group.label} {index} size="sm" />
						<span class="min-w-0 flex-1">
							{#if code}
								<span
									class="mr-1.5 rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-xs font-bold text-brand-navy"
								>
									{code}
								</span>
							{/if}
							<b class="text-brand-navy">{groupDisplayLabel(group.label, index)}</b>
							<span class="text-on-surface-variant">
								· {group.members
									.map((m) => `${nameOf(m.itemId)}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`)
									.join(', ')}
							</span>
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if lenses.length > 0}
		<fieldset class="flex flex-col gap-1">
			<legend class="text-[11px] font-bold tracking-[0.1em] text-on-surface uppercase">
				Fórmula del cliente <span class="font-medium tracking-normal normal-case">(opcional)</span>
			</legend>
			<p class="text-[12px] text-on-surface-variant">
				Se guarda como su fórmula vigente. Con "Ninguna" no se crea ni se reemplaza.
			</p>
			{#each lenses as lens (lens.id)}
				{@const owner = ownerOf(lens.id)}
				<label
					class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13px] hover:bg-surface-container-low"
				>
					<input
						type="radio"
						name="convert-primary"
						checked={primary === lens.id}
						onchange={() => onprimarychange(lens.id)}
						class="h-4 w-4 accent-brand-navy"
					/>
					<span class="min-w-0 flex-1 truncate">
						{#if owner}<b class="text-brand-navy">{owner}</b> ·
						{/if}{lens.name}
					</span>
				</label>
			{/each}
			<label
				class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13px] hover:bg-surface-container-low"
			>
				<input
					type="radio"
					name="convert-primary"
					checked={primary === null}
					onchange={() => onprimarychange(null)}
					class="h-4 w-4 accent-brand-navy"
				/>
				<span>Ninguna</span>
			</label>
		</fieldset>
	{/if}
</div>
