<script lang="ts">
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import MultiCombobox from './ui/MultiCombobox.svelte';

	interface Tag {
		key: string;
		label: string;
	}

	interface Props {
		open: boolean;
		/** Opciones de usuarios del sistema (id + nombre). */
		userOptions: Array<{ userId: string; displayName: string }>;
		pendingResponsibleTags: Tag[];
		/** True mientras se guarda en el remoto. */
		isBusy: boolean;
		onSave: () => void;
		onClose: () => void;
	}

	let {
		open = $bindable(false),
		userOptions,
		pendingResponsibleTags = $bindable([]),
		isBusy,
		onSave,
		onClose
	}: Props = $props();

	const tagVariants = $derived.by(() => {
		const map: Record<string, 'navy' | 'warning'> = {};
		for (const tag of pendingResponsibleTags) {
			map[tag.key] = userOptions.some((option) => option.userId === tag.key) ? 'navy' : 'warning';
		}
		return map;
	});
</script>

<SlideOver bind:open onclose={onClose} size="md" bodyClass="p-4">
	{#snippet header(slotProps)}
		<div class="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
			<h2 class="font-heading text-lg font-semibold text-brand-navy">Responsables del conteo</h2>
			<button
				type="button"
				aria-label="Cerrar"
				class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
				onclick={slotProps.onclose}
			>
				✕
			</button>
		</div>
	{/snippet}

	<div class="space-y-3">
		<MultiCombobox
			options={userOptions.map((option) => ({ id: option.userId, name: option.displayName }))}
			value={pendingResponsibleTags}
			placeholder="Buscar usuario o escribir un nombre…"
			createLabel="como persona externa"
			{tagVariants}
			onchange={(tags) => {
				pendingResponsibleTags = tags;
			}}
			oncreate={(name) => {
				pendingResponsibleTags = [...pendingResponsibleTags, { key: name, label: name }];
			}}
		/>
		<p class="text-sm text-on-surface-variant">
			Los usuarios activos pueden ver e interactuar con el conteo (ADMIN/MANAGER siempre). Las
			personas externas solo se registran en el informe. Quitar a alguien no borra lo que ya contó.
		</p>
	</div>

	{#snippet footer()}
		<div class="flex justify-end border-t border-outline-variant/30 px-4 py-3">
			<button
				type="button"
				aria-disabled={isBusy}
				class="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark aria-disabled:opacity-60"
				onclick={onSave}
			>
				Listo
			</button>
		</div>
	{/snippet}
</SlideOver>
