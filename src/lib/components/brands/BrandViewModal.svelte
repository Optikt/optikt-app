<script lang="ts">
	import { Modal, Button } from 'flowbite-svelte';
	import { Globe, FileText, MapPin } from '@lucide/svelte';
	import type { Brand } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		brand: Brand | null;
		onClose: () => void;
		onEdit?: () => void;
	}

	let { open = $bindable(), brand, onClose, onEdit }: Props = $props();

	function handleClose() {
		open = false;
		onClose();
	}

	function handleEdit() {
		open = false;
		onEdit?.();
	}
</script>

<Modal bind:open size="md" title="Detalles de la Marca" outsideclose onclose={handleClose}>
	{#if brand}
		<div class="space-y-6">
			<!-- Header with name -->
			<div class="border-b border-slate-200 pb-4">
				<h3 class="text-xl font-semibold text-slate-800">{brand.name}</h3>
				{#if brand.country}
					<div class="mt-2 flex items-center gap-2 text-sm text-slate-500">
						<MapPin class="h-4 w-4" />
						{brand.country}
					</div>
				{/if}
			</div>

			<!-- Website -->
			{#if brand.website}
				<div class="flex items-center gap-3">
					<Globe class="h-4 w-4 text-slate-400" />
					<a
						href={brand.website}
						target="_blank"
						rel="external noopener"
						class="text-sm text-primary-600 hover:underline"
					>
						{brand.website}
					</a>
				</div>
			{/if}

			<!-- Description -->
			{#if brand.description}
				<div class="border-t border-slate-200 pt-4">
					<h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
						<FileText class="h-4 w-4" />
						Descripción
					</h4>
					<p class="text-sm whitespace-pre-wrap text-slate-700">{brand.description}</p>
				</div>
			{/if}

			<!-- No info message -->
			{#if !brand.website && !brand.description && !brand.country}
				<p class="text-center text-sm text-slate-400 italic">
					No hay información adicional registrada
				</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex w-full justify-end gap-3">
			<Button color="alternative" onclick={handleClose}>Cerrar</Button>
			{#if onEdit}
				<Button color="primary" onclick={handleEdit}>Editar</Button>
			{/if}
		</div>
	{/snippet}
</Modal>
