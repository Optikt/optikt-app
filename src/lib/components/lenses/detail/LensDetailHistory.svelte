<script lang="ts">
	import { History } from '@lucide/svelte';
	import { formatDate } from '$lib/utils';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

	interface Props {
		item: LensCatalogItemWithRelations;
		variant: 'mobile' | 'desktop';
		onOpenHistory: () => void;
	}

	let { item, variant, onOpenHistory }: Props = $props();
</script>

{#if variant === 'mobile'}
	<div class="rounded-2xl bg-surface-container-low p-4 shadow-[var(--ds-shadow-sm)]">
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-brand-navy shadow-[var(--ds-shadow-sm)]"
			>
				<History class="h-4 w-4" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Historial</p>
				<h2 class="font-heading mt-0.5 text-base font-bold text-brand-navy">
					Trazabilidad del registro
				</h2>
			</div>
		</div>

		<div class="mt-4 divide-y divide-[var(--color-surface-container-high)]">
			<div class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Creado</p>
					<p class="mt-1 text-sm font-medium text-brand-navy">
						{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
					</p>
				</div>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Última actualización
					</p>
					<p class="mt-1 text-sm font-medium text-brand-navy">
						{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
					</p>
				</div>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Registro</p>
					<p class="mt-1 font-mono text-xs leading-5 break-all text-on-surface-variant">
						{item.id}
					</p>
				</div>
			</div>
		</div>

		<div class="mt-4">
			<button
				type="button"
				onclick={onOpenHistory}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-3.5 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark"
			>
				<History class="h-4 w-4" />
				Abrir historial completo
			</button>
		</div>
	</div>
{:else}
	<div class="rounded-[1.75rem] bg-surface-container-low px-7 py-6 shadow-[var(--ds-shadow-sm)]">
		<div class="flex items-start gap-3">
			<div
				class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container-lowest text-brand-navy shadow-[var(--ds-shadow-sm)]"
			>
				<History class="h-4 w-4" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-semibold tracking-[0.16em] text-outline uppercase">Historial</p>
				<h2 class="font-heading mt-2 text-2xl font-bold text-brand-navy">
					Trazabilidad del registro
				</h2>
			</div>
		</div>

		<div class="mt-5 space-y-3">
			<div
				class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-[var(--ds-shadow-sm)]"
			>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Creado</p>
				<p class="mt-2 text-sm font-medium text-brand-navy">
					{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
			<div
				class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-[var(--ds-shadow-sm)]"
			>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Última actualización
				</p>
				<p class="mt-2 text-sm font-medium text-brand-navy">
					{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
			<div
				class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-[var(--ds-shadow-sm)]"
			>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Registro</p>
				<p class="mt-2 font-mono text-xs leading-6 break-all text-on-surface-variant">
					{item.id}
				</p>
			</div>
		</div>

		<div class="mt-4">
			<button
				type="button"
				onclick={onOpenHistory}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-3 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark"
			>
				<History class="h-4 w-4" />
				Abrir historial completo
			</button>
		</div>
	</div>
{/if}
