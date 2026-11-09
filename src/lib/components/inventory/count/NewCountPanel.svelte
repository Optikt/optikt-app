<script lang="ts">
	import { SlideOver } from '$lib/components/ui';
	import CountLabel from './ui/CountLabel.svelte';
	import CountSegmented from './ui/CountSegmented.svelte';
	import CountButton from './ui/CountButton.svelte';
	import MultiCombobox from './ui/MultiCombobox.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatAgo, type CountCycleConfig } from '$lib/shared/inventoryCount';
	import type { ScopePreview } from '$lib/server/db/queries/inventoryCount/coverage';
	import type { CoverageData } from '$lib/server/db/queries/inventoryCount/coverage';

	interface Tag {
		key: string;
		label: string;
	}

	interface Props {
		open: boolean;
		options: CoverageData['options'];
		coverageSummary: CoverageData['summary'];
		config: CountCycleConfig;
		responsibleOptions: Array<{ userId: string; displayName: string }>;
		/** Precarga del «Contar selección» (dim + values) o del atajo (quick). */
		preload?: {
			dim: 'ALL' | 'BRAND' | 'SUPPLIER' | 'TYPE';
			values: Tag[];
			quick: 'OLDEST' | 'NEVER' | null;
		} | null;
		/** true mientras createSession está en vuelo (deshabilita y muestra «Iniciando…»). */
		submitting?: boolean;
		onClose: () => void;
		/** Crea la sesión; devuelve true si tuvo éxito (el panel resetea solo en ese caso). */
		onSubmit: (scope: {
			quick?: 'OLDEST' | 'NEVER';
			n?: number;
			dim: 'ALL' | 'BRAND' | 'SUPPLIER' | 'TYPE';
			values: Tag[];
			responsibles: Tag[];
			responsibleExternal: string[];
			notes: string;
		}) => boolean | Promise<boolean>;
	}

	let {
		open = $bindable(false),
		options,
		coverageSummary,
		config,
		responsibleOptions,
		preload = null,
		submitting = false,
		onClose,
		onSubmit
	}: Props = $props();

	let dim = $state<'ALL' | 'BRAND' | 'SUPPLIER' | 'TYPE'>('ALL');
	let values = $state<Tag[]>([]);
	let quick = $state<'OLDEST' | 'NEVER' | null>(null);
	let notes = $state('');

	let responsibles = $state<Tag[]>([]);
	let preview = $state<ScopePreview | null>(null);

	const tagVariants = $derived.by(() => {
		const map: Record<string, 'navy' | 'warning'> = {};
		for (const tag of responsibles) {
			map[tag.key] = responsibleOptions.some((option) => option.userId === tag.key)
				? 'navy'
				: 'warning';
		}
		return map;
	});

	// Preload llega en cada apertura del panel (Contar selección / atajos).
	$effect(() => {
		if (open && preload) {
			dim = preload.dim;
			values = preload.values;
			quick = preload.quick;
		}
	});

	const dimensionOptions = $derived(
		(dim === 'BRAND' ? options.BRAND : dim === 'SUPPLIER' ? options.SUPPLIER : options.TYPE) ?? []
	);

	// Vista previa viva: recalcular al cambiar alcance (debounce, no carga inicial).
	$effect(() => {
		const snapshot = { dim, values: [...values], quick };
		if (!open) return;
		const timer = setTimeout(() => {
			void refreshPreview(snapshot);
		}, 180);
		return () => clearTimeout(timer);
	});

	async function refreshPreview(_snapshot: unknown): Promise<void> {
		// remote previewCountScope (dinámica de previewScope): ver remote/inventoryCount.remote
		const { previewCountScope } = await import('$lib/remote/inventoryCount.remote');
		try {
			preview = await previewCountScope({
				dim: dim as never,
				values: values.map((tag) => tag.key),
				quick: quick ?? undefined,
				n: quick === 'OLDEST' ? config.quickOldestLimit : undefined
			});
		} catch {
			preview = null;
		}
	}

	function reset(): void {
		dim = 'ALL';
		values = [];
		quick = null;
		notes = '';
		responsibles = [];
		preview = null;
	}

	function canStart(): boolean {
		const hasItems = preview?.total != null && preview.total > 0;
		return Boolean(hasItems && responsibles.length >= 1);
	}

	async function handleSubmit(): Promise<void> {
		if (!canStart() || submitting) return;
		let ok = false;
		try {
			ok = await onSubmit({
				quick: quick ?? undefined,
				n: quick === 'OLDEST' ? config.quickOldestLimit : undefined,
				dim,
				values,
				responsibles,
				responsibleExternal: responsibles
					.filter((tag) => !responsibleOptions.some((o) => o.userId === tag.key))
					.map((tag) => tag.label),
				notes
			});
		} catch {
			ok = false; // createCount ya toastea; aquí solo conservamos el formulario
		}
		// Reset solo en éxito: si falla, el usuario conserva lo que había elegido.
		if (ok) reset();
	}
</script>

<SlideOver bind:open onclose={onClose} size="md" bodyClass="p-4">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
			<h2 class="font-heading text-lg font-semibold text-brand-navy">Nuevo conteo</h2>
			<button
				type="button"
				aria-label="Cerrar"
				class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
				onclick={onclose}
			>
				✕
			</button>
		</div>
	{/snippet}

	<div class="space-y-4">
		<div>
			<div class="mb-1.5 flex items-center gap-1">
				<CountLabel
					text="¿Qué vas a contar?"
					tooltip="Alcance|Un conteo puede reunir varias marcas, o varios proveedores, o varios tipos. No se cruzan entre sí."
				/>
			</div>
			<CountSegmented
				value={dim}
				ariaLabel="Alcance"
				options={[
					{
						value: 'ALL',
						label: 'Todo',
						tooltip: 'Todo|Todo el inventario elegible, incluidos los que nunca se han contado.'
					},
					{
						value: 'BRAND',
						label: 'Marca',
						tooltip: 'Marca|Una o varias marcas a la vez; nunca se cruza con proveedor ni tipo.'
					},
					{
						value: 'SUPPLIER',
						label: 'Proveedor',
						tooltip: 'Proveedor|Uno o varios proveedores a la vez; incluye sus lentes con stock.'
					},
					{
						value: 'TYPE',
						label: 'Tipo',
						tooltip:
							'Tipo|Uno o varios tipos de producto a la vez; no se cruza con marca ni proveedor.'
					}
				]}
				onchange={(value) => {
					dim = value as typeof dim;
					values = [];
					quick = null;
				}}
			/>

			{#if dim === 'ALL'}
				<div class="mt-3 space-y-2">
					<TriggerTooltip
						title="Todo el inventario"
						text="Contar todos los ítems elegibles"
						side="top"
					>
						{#snippet trigger({ props })}
							<button
								{...props}
								type="button"
								aria-pressed={quick == null}
								class="opt flex w-full items-center gap-3 rounded-lg border border-outline-variant/40 px-3 py-2.5 text-left transition-colors {quick ==
								null
									? 'border-brand-blue bg-info-container'
									: 'hover:bg-surface-container-low'}"
								onclick={() => (quick = null)}
							>
								<span class="flex-1">
									<b class="text-sm text-brand-navy">Todo el inventario</b>
								</span>
								<span class="text-sm font-semibold text-brand-navy"
									>{coverageSummary.itemCount}</span
								>
							</button>
						{/snippet}
					</TriggerTooltip>
					<TriggerTooltip
						title={`Los ${config.quickOldestLimit} más atrasados`}
						text="Los de conteo más antiguo en todo el inventario"
						side="top"
					>
						{#snippet trigger({ props })}
							<button
								{...props}
								type="button"
								aria-pressed={quick === 'OLDEST'}
								class="opt flex w-full items-center gap-3 rounded-lg border border-outline-variant/40 px-3 py-2.5 text-left transition-colors {quick ===
								'OLDEST'
									? 'border-brand-blue bg-info-container'
									: 'hover:bg-surface-container-low'}"
								onclick={() => (quick = 'OLDEST')}
							>
								<span class="flex-1">
									<b class="text-sm text-brand-navy">Los {config.quickOldestLimit} más atrasados</b>
								</span>
								<span class="text-sm font-semibold text-brand-navy">{config.quickOldestLimit}</span>
							</button>
						{/snippet}
					</TriggerTooltip>
					<TriggerTooltip
						title="Solo nunca contados"
						text="Jamás estuvieron en un conteo cerrado"
						side="top"
					>
						{#snippet trigger({ props })}
							<button
								{...props}
								type="button"
								aria-pressed={quick === 'NEVER'}
								class="opt flex w-full items-center gap-3 rounded-lg border border-outline-variant/40 px-3 py-2.5 text-left transition-colors {quick ===
								'NEVER'
									? 'border-brand-blue bg-info-container'
									: 'hover:bg-surface-container-low'}"
								onclick={() => (quick = 'NEVER')}
							>
								<span class="flex-1">
									<b class="text-sm text-brand-navy">Solo nunca contados</b>
								</span>
								<span class="text-sm font-semibold text-brand-navy"
									>{coverageSummary.neverCounted}</span
								>
							</button>
						{/snippet}
					</TriggerTooltip>
				</div>
			{:else}
				<MultiCombobox
					options={dimensionOptions.map((option) => ({
						id: option.id,
						name: option.name,
						subtext: `${option.itemCount} ítems ${option.trafficState === 'ok' ? '• al día' : option.trafficState === 'none' ? '• nunca' : '• atrasado'}`
					}))}
					value={values}
					placeholder={`Buscar ${dim === 'BRAND' ? 'marcas' : dim === 'SUPPLIER' ? 'proveedores' : 'tipos'}…`}
					onchange={(tags) => (values = tags)}
				/>
			{/if}
		</div>

		<div>
			<div class="mb-1.5">
				<CountLabel
					text="Responsables del conteo"
					tooltip="Responsables|Usuarios del sistema (pueden ver e interactuar con el conteo) o nombres libres de personas externas. ADMIN y MANAGER siempre pueden."
				/>
			</div>
			<MultiCombobox
				options={responsibleOptions.map((option) => ({
					id: option.userId,
					name: option.displayName
				}))}
				value={responsibles}
				placeholder="Buscar usuario o escribir un nombre…"
				createLabel="→ como persona externa"
				{tagVariants}
				onchange={(tags) => {
					responsibles = tags;
				}}
				oncreate={(name) => {
					// Persona externa: queda registrada sin usuario.
					responsibles = [...responsibles, { key: name, label: name }];
				}}
			/>
		</div>

		<div
			class="rounded-lg bg-info-container px-3 py-2.5 text-sm font-medium text-on-info-container"
		>
			{#if preview}
				{preview.total} ítems · {preview.zeroStock} con stock 0 · más antiguo:
				{formatAgo(preview.oldestAgeDays)}
			{:else}
				Calculando alcance…
			{/if}
		</div>

		<label class="block">
			<CountLabel
				text="Notas"
				class="mb-1.5"
				tooltip="Notas|Información útil sobre el conteo para quien lo cierre."
			/>
			<textarea
				bind:value={notes}
				rows="2"
				maxlength="500"
				class="w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm text-on-surface"
				placeholder="Notas operativas (opcional)"></textarea>
		</label>
	</div>

	{#snippet footer()}
		<div class="flex justify-end gap-2 border-t border-outline-variant/30 px-4 py-3">
			<button
				type="button"
				class="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
				onclick={onClose}
			>
				Cancelar
			</button>
			<CountButton
				variant="gold"
				disabled={!canStart() || submitting}
				disabledTooltip={!canStart() && !submitting
					? 'Falta algo|Elige qué contar y al menos un responsable.'
					: undefined}
				onclick={handleSubmit}
			>
				{#snippet child()}{submitting ? 'Iniciando…' : 'Iniciar conteo'}{/snippet}
			</CountButton>
		</div>
	{/snippet}
</SlideOver>
