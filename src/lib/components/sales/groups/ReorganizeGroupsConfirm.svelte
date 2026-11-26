<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import { groupCode, groupDisplayLabel, type ItemGroup } from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';

	/**
	 * Explicit safeguard when modifying an already-saved person organization:
	 * warns that existing numeric identifiers (e.g. 230-1, 230-2) will change.
	 */
	interface Props {
		open: boolean;
		kind: 'sale' | 'quote';
		docLabel?: string;
		previousGroups: readonly ItemGroup[];
		nextGroups: readonly ItemGroup[];
		loading?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		kind,
		docLabel,
		previousGroups,
		nextGroups,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	const entity = $derived(kind === 'quote' ? 'este presupuesto' : 'esta venta');
</script>

<ConfirmModal
	bind:open
	size="md"
	title="¿Reorganizar identificadores?"
	confirmLabel="Sí, reorganizar"
	cancelLabel="Volver"
	confirmColor="red"
	permanent={loading}
	{loading}
	{onConfirm}
	{onCancel}
>
	{#snippet icon()}
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
		>
			<TriangleAlert class="h-5 w-5" />
		</div>
	{/snippet}

	{#snippet body()}
		<div class="space-y-3 text-sm text-on-surface">
			<p>
				Los grupos de {entity} ya tenían identificadores generados. Si guardas esta reorganización,
				<b>los códigos pueden cambiar</b> y dejar de coincidir con fórmulas o referencias enviadas al
				laboratorio.
			</p>

			<div
				class="grid grid-cols-1 gap-2 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-[13px] sm:grid-cols-2"
			>
				<div>
					<p
						class="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase"
					>
						Actuales
					</p>
					<ul class="space-y-1.5">
						{#each previousGroups as group, index (index)}
							{@const code = groupCode(docLabel, index)}
							<li class="flex items-center gap-1.5">
								<PersonAvatar label={group.label} {index} size="sm" />
								{#if code}
									<span
										class="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-xs font-bold text-brand-navy"
									>
										{code}
									</span>
								{/if}
								<span class="truncate font-semibold">{groupDisplayLabel(group.label, index)}</span>
							</li>
						{/each}
					</ul>
				</div>

				<div>
					<p class="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-amber-800 uppercase">
						Nuevos
					</p>
					{#if nextGroups.length === 0}
						<p class="text-on-surface-variant italic">Sin agrupación</p>
					{:else}
						<ul class="space-y-1.5">
							{#each nextGroups as group, index (index)}
								{@const code = groupCode(docLabel, index)}
								<li class="flex items-center gap-1.5">
									<PersonAvatar label={group.label} {index} size="sm" />
									{#if code}
										<span
											class="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-900"
										>
											{code}
										</span>
									{/if}
									<span class="truncate font-semibold">
										{groupDisplayLabel(group.label, index)}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	{/snippet}
</ConfirmModal>
