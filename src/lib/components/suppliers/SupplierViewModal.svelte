<script lang="ts">
	import { Modal, Button } from 'flowbite-svelte';
	import {
		Phone,
		Mail,
		Globe,
		MapPin,
		Instagram,
		MessageCircle,
		User,
		FileText,
		Tag
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SupplierTypeBadge } from '$lib/components/ui';
	import { listBrandsForSupplier } from '$lib/remote/suppliers.remote';
	import type { Supplier } from '$lib/server/db/schema';
	import { formatPhone, getErrorMessage } from '$lib/utils';

	type RelatedBrand = {
		id: string;
		name: string;
	};

	interface Props {
		open: boolean;
		supplier: Supplier | null;
		onClose: () => void;
		onEdit?: () => void;
	}

	let { open = $bindable(), supplier, onClose, onEdit }: Props = $props();
	let relatedBrands = $state<RelatedBrand[]>([]);
	let loadingRelations = $state(false);
	let relationsError = $state<string | null>(null);
	let relationRequestId = 0;

	function handleClose() {
		open = false;
		onClose();
	}

	function handleEdit() {
		open = false;
		onEdit?.();
	}

	async function loadRelatedBrands(supplierId: string) {
		const requestId = ++relationRequestId;
		loadingRelations = true;
		relationsError = null;

		try {
			const brandsQuery = listBrandsForSupplier({ id: supplierId });
			const brands = await brandsQuery;
			if (requestId !== relationRequestId) return;
			relatedBrands = brands;
		} catch (error) {
			console.error(error);
			if (requestId !== relationRequestId) return;
			relatedBrands = [];
			relationsError = 'No se pudieron cargar las marcas relacionadas.';
			toast.error(getErrorMessage(error, 'Error cargando marcas relacionadas'));
		} finally {
			if (requestId === relationRequestId) {
				loadingRelations = false;
			}
		}
	}

	$effect(() => {
		const supplierId = supplier?.id;

		if (!open || !supplierId) {
			relatedBrands = [];
			relationsError = null;
			loadingRelations = false;
			return;
		}

		void loadRelatedBrands(supplierId);
	});
</script>

<Modal bind:open size="lg" title="Detalles del Proveedor" outsideclose onclose={handleClose}>
	{#if supplier}
		<div class="space-y-6">
			<!-- Header with name and type -->
			<div class="flex items-start justify-between border-b border-slate-200 pb-4">
				<div>
					<h3 class="text-xl font-semibold text-slate-800">{supplier.name}</h3>
					{#if supplier.rif}
						<p class="mt-1 font-mono text-sm text-slate-500">{supplier.rif}</p>
					{/if}
				</div>
				<SupplierTypeBadge type={supplier.type} class="text-sm" />
			</div>

			<!-- Contact Information -->
			<div class="grid grid-cols-2 gap-6">
				<div class="space-y-4">
					<h4 class="text-sm font-medium text-slate-600">Información de Contacto</h4>

					<div class="flex items-center gap-3">
						<Phone class="h-4 w-4 text-slate-400" />
						<span class="text-sm text-slate-700">{formatPhone(supplier.primaryPhone)}</span>
					</div>

					{#if supplier.email}
						<div class="flex items-center gap-3">
							<Mail class="h-4 w-4 text-slate-400" />
							<a href="mailto:{supplier.email}" class="text-sm text-primary-600 hover:underline">
								{supplier.email}
							</a>
						</div>
					{/if}

					{#if supplier.website}
						<div class="flex items-center gap-3">
							<Globe class="h-4 w-4 text-slate-400" />
							<a
								href={supplier.website}
								target="_blank"
								rel="external noopener"
								class="text-sm text-primary-600 hover:underline"
							>
								{supplier.website}
							</a>
						</div>
					{/if}

					{#if supplier.address}
						<div class="flex items-start gap-3">
							<MapPin class="h-4 w-4 shrink-0 text-slate-400" />
							<span class="text-sm text-slate-700">{supplier.address}</span>
						</div>
					{/if}
				</div>

				<!-- Social Media -->
				<div class="space-y-4">
					<h4 class="text-sm font-medium text-slate-600">Redes Sociales</h4>

					{#if supplier.instagram}
						<div class="flex items-center gap-3">
							<Instagram class="h-4 w-4 text-slate-400" />
							<a
								href="https://instagram.com/{supplier.instagram.replace('@', '')}"
								target="_blank"
								rel="external noopener"
								class="text-sm text-primary-600 hover:underline"
							>
								{supplier.instagram}
							</a>
						</div>
					{/if}

					{#if supplier.whatsapp}
						<div class="flex items-center gap-3">
							<MessageCircle class="h-4 w-4 text-slate-400" />
							<a
								href="https://wa.me/{supplier.whatsapp.replace(/[^0-9]/g, '')}"
								target="_blank"
								rel="external noopener"
								class="text-sm text-primary-600 hover:underline"
							>
								{supplier.whatsapp}
							</a>
						</div>
					{/if}

					{#if !supplier.instagram && !supplier.whatsapp}
						<p class="text-sm text-slate-400 italic">Sin redes sociales registradas</p>
					{/if}
				</div>
			</div>

			<!-- Contact Person -->
			{#if supplier.contactName || supplier.contactPhone || supplier.contactRole}
				<div class="border-t border-slate-200 pt-4">
					<h4 class="mb-3 text-sm font-medium text-slate-600">Persona de Contacto</h4>
					<div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
							<User class="h-5 w-5 text-slate-500" />
						</div>
						<div>
							<p class="font-medium text-slate-700">{supplier.contactName ?? 'Sin nombre'}</p>
							<p class="text-sm text-slate-500">
								{supplier.contactRole ?? 'Sin cargo'}
								{#if supplier.contactPhone}
									• {supplier.contactPhone}
								{/if}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Notes -->
			{#if supplier.notes}
				<div class="border-t border-slate-200 pt-4">
					<h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
						<FileText class="h-4 w-4" />
						Notas
					</h4>
					<p class="text-sm whitespace-pre-wrap text-slate-700">{supplier.notes}</p>
				</div>
			{/if}

			<div class="border-t border-slate-200 pt-4">
				<h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-600">
					<Tag class="h-4 w-4" />
					Marcas que provee
				</h4>

				{#if loadingRelations}
					<p class="text-sm text-slate-500">Cargando marcas relacionadas...</p>
				{:else if relationsError}
					<p class="text-sm text-red-600">{relationsError}</p>
				{:else if relatedBrands.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each relatedBrands as brand (brand.id)}
							<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
								{brand.name}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-slate-500 italic">
						Aún no hay marcas registradas para este proveedor.
					</p>
				{/if}
			</div>
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
