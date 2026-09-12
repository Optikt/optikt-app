<script lang="ts">
	import { CheckCircle2, X } from '@lucide/svelte';
	import { ALL_PRODUCT_TYPES, PRODUCT_TYPE_LABELS, type ProductType } from '$lib/shared/enums';
	import type { InventoryCountScopeType } from '$lib/schemas/inventoryCount';
	import { COUNT_SCOPE_OPTIONS, getScopeLabel } from './countList';

	interface Props {
		showCreate: boolean;
		isSubmitting: boolean;
		scopeType: InventoryCountScopeType;
		scopeValue: ProductType | '';
		notes: string;
		formError: string;
		onSelectScope: (scope: InventoryCountScopeType) => void;
		onClose: () => void;
		onSubmit: () => void;
		onKeydown: (event: KeyboardEvent) => void;
	}

	let {
		showCreate = $bindable(),
		isSubmitting,
		scopeType = $bindable(),
		scopeValue = $bindable(),
		notes = $bindable(),
		formError,
		onSelectScope,
		onClose,
		onSubmit,
		onKeydown
	}: Props = $props();
</script>

{#if showCreate}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !isSubmitting) {
				showCreate = false;
			}
		}}
		onkeydown={onKeydown}
		tabindex="-1"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="inventory-count-create-title"
			class="w-full max-w-4xl rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Nuevo conteo
					</p>
					<h2 id="inventory-count-create-title" class="mt-1 text-xl font-semibold text-brand-navy">
						Iniciar sesión
					</h2>
				</div>

				<button
					type="button"
					onclick={onClose}
					disabled={isSubmitting}
					class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-navy"
					aria-label="Cerrar modal"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
				<div class="space-y-5">
					<div class="space-y-2">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Alcance del conteo
						</span>
						<div class="grid gap-3 md:grid-cols-3">
							{#each COUNT_SCOPE_OPTIONS as option (option.value)}
								{@const ScopeIcon = option.icon}
								<button
									type="button"
									onclick={() => onSelectScope(option.value)}
									aria-pressed={scopeType === option.value}
									class={`cursor-pointer rounded-2xl border px-4 py-4 text-left transition-colors ${scopeType === option.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-outline-variant/20 bg-surface-container text-on-surface hover:border-brand-navy/25 hover:bg-surface-container-high'}`}
								>
									<div
										class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-current"
									>
										<ScopeIcon class="h-4.5 w-4.5" />
									</div>
									<p class="mt-3 text-sm font-semibold">{option.label}</p>
									<p
										class={`mt-1 text-xs ${scopeType === option.value ? 'text-white/75' : 'text-on-surface-variant'}`}
									>
										{option.description}
									</p>
								</button>
							{/each}
						</div>
					</div>

					{#if scopeType === 'PRODUCT_CATEGORY'}
						<label class="block space-y-2">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Categoría de productos
							</span>
							<select
								bind:value={scopeValue}
								class="w-full rounded-2xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface"
							>
								<option value="">Todos los productos</option>
								{#each ALL_PRODUCT_TYPES as type (type)}
									<option value={type}>{PRODUCT_TYPE_LABELS[type]}</option>
								{/each}
							</select>
							<p class="text-xs text-on-surface-variant">
								Deja “Todos los productos” para auditar la línea completa.
							</p>
						</label>
					{/if}

					<label class="block space-y-2">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Notas operativas
						</span>
						<textarea
							bind:value={notes}
							rows="5"
							class="w-full rounded-2xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface"
							placeholder="Observaciones opcionales para esta sesión"></textarea>
					</label>

					{#if formError}
						<div
							class="rounded-2xl border border-error/15 bg-error-container px-4 py-3 text-sm text-on-error-container"
						>
							{formError}
						</div>
					{/if}
				</div>

				<aside class="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Antes de iniciar
					</p>
					<h3 class="mt-1 text-lg font-semibold text-brand-navy">Checklist de una sesión sana</h3>
					<div class="mt-4 space-y-3 text-sm text-on-surface-variant">
						<div class="flex items-start gap-3">
							<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
							<p>Se toma un snapshot del stock actual como punto de referencia.</p>
						</div>
						<div class="flex items-start gap-3">
							<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
							<p>Solo puede existir una sesión activa a la vez.</p>
						</div>
						<div class="flex items-start gap-3">
							<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
							<p>Las diferencias quedan como informe; los ajustes se hacen manualmente.</p>
						</div>
						<div class="flex items-start gap-3">
							<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
							<p>Cada línea deberá contarse o confirmarse explícitamente antes de cerrar.</p>
						</div>
					</div>

					<div
						class="mt-5 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-on-surface-variant"
					>
						<p class="font-medium text-brand-navy">Alcance seleccionado</p>
						<p class="mt-1">{getScopeLabel(scopeType)}</p>
					</div>
				</aside>
			</div>

			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={onClose}
					disabled={isSubmitting}
					class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={onSubmit}
					disabled={isSubmitting}
					class="rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting ? 'Iniciando...' : 'Iniciar sesión'}
				</button>
			</div>
		</div>
	</div>
{/if}
