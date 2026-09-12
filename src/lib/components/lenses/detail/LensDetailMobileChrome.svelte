<script lang="ts">
	import { ArrowLeft, MoreVertical, Pencil, Trash2 } from '@lucide/svelte';

	export type LensDetailMobileTab = 'detalles' | 'comercial' | 'historial';

	interface Props {
		itemName: string;
		isAdmin: boolean;
		mobileTab: LensDetailMobileTab;
		showContextMenu: boolean;
		onBack: () => void;
		onEdit: () => void;
		onDelete: () => void;
	}

	let {
		itemName,
		isAdmin,
		mobileTab = $bindable(),
		showContextMenu = $bindable(),
		onBack,
		onEdit,
		onDelete
	}: Props = $props();
</script>

<div class="sticky z-40 flex flex-col bg-white shadow-sm">
	<div
		class="flex items-center gap-3 border-b border-[var(--color-surface-container-high)] bg-white px-2 py-1"
	>
		<button
			type="button"
			onclick={onBack}
			class="flex h-10 w-10 items-center justify-center rounded-xl text-brand-navy transition-colors hover:bg-surface-container"
			aria-label="Volver al catálogo"
		>
			<ArrowLeft class="h-5 w-5" />
		</button>
		<h1 class="font-heading min-w-0 flex-1 truncate text-base font-bold text-brand-navy">
			{itemName}
		</h1>
		{#if isAdmin}
			<div class="relative" data-context-menu>
				<button
					type="button"
					onclick={() => (showContextMenu = !showContextMenu)}
					class="flex h-10 w-10 items-center justify-center rounded-xl text-brand-navy transition-colors hover:bg-surface-container"
					aria-label="Más opciones"
				>
					<MoreVertical class="h-5 w-5" />
				</button>
				{#if showContextMenu}
					<div
						class="absolute top-full right-0 z-50 mt-1 min-w-44 rounded-xl border border-[var(--color-surface-container-high)] bg-white py-1 shadow-lg"
					>
						<button
							type="button"
							onclick={() => {
								showContextMenu = false;
								onEdit();
							}}
							class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
						>
							<Pencil class="h-4 w-4" />
							Editar
						</button>
						<button
							type="button"
							onclick={onDelete}
							class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-on-error-container transition-colors hover:bg-error-container"
						>
							<Trash2 class="h-4 w-4" />
							Eliminar
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="flex gap-0 border-b border-[var(--color-surface-container-high)] bg-white px-4">
		<button
			type="button"
			onclick={() => (mobileTab = 'detalles')}
			class="relative px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors"
			class:text-brand-navy={mobileTab === 'detalles'}
			class:text-outline={mobileTab !== 'detalles'}
		>
			Detalles
			{#if mobileTab === 'detalles'}
				<span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-navy"></span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (mobileTab = 'comercial')}
			class="relative px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors"
			class:text-brand-navy={mobileTab === 'comercial'}
			class:text-outline={mobileTab !== 'comercial'}
		>
			Comercial
			{#if mobileTab === 'comercial'}
				<span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-gold"></span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (mobileTab = 'historial')}
			class="relative px-4 py-3 text-xs font-bold tracking-[0.12em] uppercase transition-colors"
			class:text-brand-navy={mobileTab === 'historial'}
			class:text-outline={mobileTab !== 'historial'}
		>
			Historial
			{#if mobileTab === 'historial'}
				<span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-navy"></span>
			{/if}
		</button>
	</div>
</div>
