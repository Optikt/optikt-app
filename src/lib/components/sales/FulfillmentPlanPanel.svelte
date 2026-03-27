<script lang="ts">
	import {
		Truck,
		Package,
		Archive,
		Link2,
		AlertTriangle,
		ChevronDown,
		ChevronUp,
		Eye,
		Undo2
	} from '@lucide/svelte';
	import {
		FulfillmentSource,
		FulfillmentWarningCode,
		type FulfillmentPlanResult,
		type CatalogItemForPlanning
	} from '$lib/shared/planning';
	import { PatientEye } from '$lib/shared/contracts/common';

	interface Props {
		plan: FulfillmentPlanResult;
		catalog: Map<string, CatalogItemForPlanning>;
		singleUnitOverrides?: Map<string, 'FORCE_PAIR'>;
		onoverridechange?: (catalogItemId: string, action: 'FORCE_PAIR' | 'UNDO') => void;
	}

	let { plan, catalog, singleUnitOverrides, onoverridechange }: Props = $props();

	let expandedLines = $state<Set<string>>(new Set());

	function toggleExpand(reqId: string) {
		const next = new Set(expandedLines);
		if (next.has(reqId)) next.delete(reqId);
		else next.add(reqId);
		expandedLines = next;
	}

	function getCatalogName(itemId: string): string {
		return catalog.get(itemId)?.name ?? '—';
	}

	const SOURCE_DISPLAY: Record<
		string,
		{ label: string; bgColor: string; textColor: string; borderColor: string }
	> = {
		[FulfillmentSource.SUPPLIER_ORDER]: {
			label: 'Pedido a proveedor',
			bgColor: 'bg-blue-50',
			textColor: 'text-blue-700',
			borderColor: 'border-blue-200'
		},
		[FulfillmentSource.SURPLUS_STOCK]: {
			label: 'Excedente en inventario',
			bgColor: 'bg-emerald-50',
			textColor: 'text-emerald-700',
			borderColor: 'border-emerald-200'
		},
		[FulfillmentSource.CATALOG_STOCK]: {
			label: 'Stock de catálogo',
			bgColor: 'bg-emerald-50',
			textColor: 'text-emerald-700',
			borderColor: 'border-emerald-200'
		},
		[FulfillmentSource.PAIR_BUNDLED]: {
			label: 'Incluido en par',
			bgColor: 'bg-slate-50',
			textColor: 'text-slate-600',
			borderColor: 'border-slate-200'
		},
		[FulfillmentSource.LAB_ORDER]: {
			label: 'Pedido a laboratorio',
			bgColor: 'bg-violet-50',
			textColor: 'text-violet-700',
			borderColor: 'border-violet-200'
		}
	};

	const WARNING_DISPLAY: Record<string, { label: string; severity: 'amber' | 'red' }> = {
		[FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS]: {
			label: 'Se comprará un par — quedará excedente',
			severity: 'amber'
		},
		[FulfillmentWarningCode.CONSULT_REQUIRED]: {
			label: 'Requiere consulta con proveedor',
			severity: 'amber'
		},
		[FulfillmentWarningCode.SINGLE_UNIT_SURCHARGE]: {
			label: 'Recargo por unidad individual',
			severity: 'amber'
		},
		[FulfillmentWarningCode.SINGLE_UNIT_REQUIRES_CONFIRMATION]: {
			label: 'El proveedor debe confirmar que acepta vender una sola unidad',
			severity: 'amber'
		},
		[FulfillmentWarningCode.BELOW_MINIMUM_ORDER]: {
			label: 'Por debajo del mínimo de pedido',
			severity: 'red'
		},
		[FulfillmentWarningCode.TREATMENT_NOT_AVAILABLE]: {
			label: 'Tratamiento no disponible',
			severity: 'red'
		},
		[FulfillmentWarningCode.RANGE_NOT_PUBLISHED]: {
			label: 'Rango óptico no publicado',
			severity: 'amber'
		},
		[FulfillmentWarningCode.LOW_STOCK]: {
			label: 'Stock bajo',
			severity: 'amber'
		}
	};

	function getSourceIcon(source: FulfillmentSource) {
		switch (source) {
			case FulfillmentSource.SUPPLIER_ORDER:
				return Truck;
			case FulfillmentSource.SURPLUS_STOCK:
				return Archive;
			case FulfillmentSource.CATALOG_STOCK:
				return Package;
			case FulfillmentSource.PAIR_BUNDLED:
				return Link2;
			case FulfillmentSource.LAB_ORDER:
				return Truck;
			default:
				return Package;
		}
	}

	function eyeLabel(eye: PatientEye): string {
		return eye === PatientEye.OD ? 'OD' : 'OI';
	}

	const hasWarnings = $derived(plan.lines.some((l) => l.warnings.length > 0));
</script>

<div class="space-y-3">
	<!-- Plan Lines -->
	{#each plan.lines as line (line.requirementId)}
		{@const source =
			SOURCE_DISPLAY[line.source] ?? SOURCE_DISPLAY[FulfillmentSource.SUPPLIER_ORDER]}
		{@const SourceIcon = getSourceIcon(line.source)}
		{@const lineWarnings = line.warnings
			.map((w) => WARNING_DISPLAY[w])
			.filter((w): w is NonNullable<typeof w> => !!w)}
		{@const hasLineDetail = lineWarnings.length > 0 || line.requiresConfirmation}
		{@const isExpanded = expandedLines.has(line.requirementId)}
		<div class="rounded-lg border {source.borderColor} {source.bgColor}">
			<!-- Line Header -->
			{#snippet lineHeaderContent()}
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {source.bgColor}"
					>
						<SourceIcon class="h-4 w-4 {source.textColor}" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<span
								class="inline-flex items-center gap-1 text-sm font-semibold {line.eye ===
								PatientEye.OD
									? 'text-emerald-700'
									: 'text-violet-700'}"
							>
								<Eye class="h-3.5 w-3.5" />
								{eyeLabel(line.eye)}
							</span>
							<span class="text-sm font-medium text-slate-700">
								{getCatalogName(line.catalogItemId)}
							</span>
						</div>
						<span class="text-xs font-medium {source.textColor}">
							{source.label}
						</span>
					</div>
				</div>
				{#if hasLineDetail}
					<div class="flex items-center gap-2">
						{#if lineWarnings.length > 0}
							<AlertTriangle
								class="h-4 w-4 {lineWarnings.some((w) => w.severity === 'red')
									? 'text-red-500'
									: 'text-amber-500'}"
							/>
						{/if}
						{#if isExpanded}
							<ChevronUp class="h-4 w-4 text-slate-400" />
						{:else}
							<ChevronDown class="h-4 w-4 text-slate-400" />
						{/if}
					</div>
				{/if}
			{/snippet}
			{#if hasLineDetail}
				<button
					type="button"
					class="flex w-full items-center justify-between px-4 py-3 text-left"
					onclick={() => toggleExpand(line.requirementId)}
				>
					{@render lineHeaderContent()}
				</button>
			{:else}
				<div class="flex w-full items-center justify-between px-4 py-3">
					{@render lineHeaderContent()}
				</div>
			{/if}

			<!-- Expanded: Warnings + Confirmation -->
			{#if hasLineDetail && isExpanded}
				<div class="border-t {source.borderColor} px-4 pt-2 pb-3">
					<!-- Warnings -->
					{#if lineWarnings.length > 0}
						<div class="space-y-1">
							{#each lineWarnings as w}
								<div
									class="flex items-center gap-1.5 text-xs font-medium {w.severity === 'red'
										? 'text-red-600'
										: 'text-amber-600'}"
								>
									<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
									{w.label}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Confirmation required -->
					{#if line.requiresConfirmation}
						{@const isOverridden = singleUnitOverrides?.has(line.catalogItemId)}
						{#if isOverridden}
							<div class="mt-2 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2">
								<Package class="h-4 w-4 shrink-0 text-emerald-600" />
								<span class="text-xs font-medium text-emerald-700">
									Se comprará el par completo
								</span>
								{#if onoverridechange}
									<button
										type="button"
										class="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
										onclick={() => onoverridechange(line.catalogItemId, 'UNDO')}
									>
										<Undo2 class="h-3 w-3" />
										Deshacer
									</button>
								{/if}
							</div>
						{:else}
							<div class="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
								<AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
								<span class="text-xs font-medium text-amber-700">
									Debes confirmar manualmente con el proveedor que este lente puede pedirse por
									unidad
								</span>
							</div>
							{#if onoverridechange}
								<button
									type="button"
									class="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
									onclick={() => onoverridechange(line.catalogItemId, 'FORCE_PAIR')}
								>
									El proveedor rechazó → Comprar par completo
								</button>
							{/if}
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	{/each}

	<!-- Surplus Section -->
	{#if plan.surplus.length > 0}
		<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
			<div class="flex items-center gap-2">
				<Archive class="h-4 w-4 text-amber-600" />
				<span class="text-sm font-semibold text-amber-800">
					Esta venta genera {plan.surplus.reduce((a, s) => a + s.surplusUnits, 0)} unidad(es) de excedente
				</span>
			</div>
			<div class="mt-2 space-y-1">
				{#each plan.surplus as surplus}
					<div class="flex items-center justify-between text-sm">
						<span class="text-amber-700">
							{getCatalogName(surplus.catalogItemId)}
							{#if surplus.predeterminedPrescription}
								<span class="font-mono text-xs">
									(Esf: {surplus.predeterminedPrescription.sphere ?? '—'}, Cil: {surplus
										.predeterminedPrescription.cylinder ?? '—'})
								</span>
							{:else}
								<span class="text-xs italic">Rx a definir</span>
							{/if}
						</span>
						<span class="text-xs text-amber-600"> Quedará en stock </span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Global Warnings -->
	{#if plan.requiresAnyConfirmation}
		<div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
			<AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
			<span class="text-sm font-medium text-amber-700">
				Algunas líneas requieren confirmación antes de completar la venta
			</span>
		</div>
	{/if}
</div>
