<script lang="ts">
	/**
	 * GRADUACIÓN + MEDIDAS blocks for the lens editor (design §8.5).
	 * Pure presentation: the caller derives per-eye statuses and drives the
	 * draft; formatting (¼ dioptrías, eje 0–180, mm entero) lives here.
	 */
	import { Check, TriangleAlert } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatOpticalInput, stepOpticalValue, type OpticalInputKind } from './lensEditor';
	import type { LensEditorEyeDraft } from './types';

	interface Props {
		od: LensEditorEyeDraft;
		oi: LensEditorEyeDraft;
		requiresAddition: boolean;
		status: Record<'od' | 'oi', { tone: 'ok' | 'w' | 'n'; label: string }>;
		onCopy: () => void;
	}

	let { od = $bindable(), oi = $bindable(), requiresAddition, status, onCopy }: Props = $props();

	// Raw text per input cell (keyed) so typing feels native; formatted on blur.
	type CellKey = `od.${OpticalInputKind}` | `oi.${OpticalInputKind}` | 'od.altura' | 'oi.altura';
	let raw = $state<Record<string, string>>({});

	const mmCell: Record<string, 'altura' | 'dp' | 'dnp'> = {
		altura: 'altura',
		dp: 'dp',
		dnp: 'dnp'
	};

	function fieldFor(kind: OpticalInputKind, cell: string): keyof LensEditorEyeDraft {
		if (kind === 'eje') return 'axis' as keyof LensEditorEyeDraft;
		if (kind === 'mm') return (mmCell[cell.split('.')[1]] ?? 'dp') as keyof LensEditorEyeDraft;
		return (
			kind === 'esf' ? 'sphere' : kind === 'cil' ? 'cylinder' : 'addition'
		) as keyof LensEditorEyeDraft;
	}

	function formatDisplay(value: number | null, kind: OpticalInputKind): string {
		if (value == null) return '';
		const formatted = formatOpticalInput(String(value), kind);
		return formatted || String(value);
	}

	function current(
		cell: CellKey,
		val: LensEditorEyeDraft,
		field: keyof LensEditorEyeDraft,
		kind: OpticalInputKind
	): string {
		return raw[cell] ?? formatDisplay(val[field] as number | null, kind);
	}

	function step(cell: CellKey, kind: OpticalInputKind, eye: 'od' | 'oi', dir: 1 | -1): void {
		const target = eye === 'od' ? od : oi;
		const key = fieldFor(kind, cell) as keyof LensEditorEyeDraft;
		const current = Number(target[key] ?? 0);
		const next = stepOpticalValue(current, kind, dir);
		(target[key] as number) = next;
		// Sync the display cache too: it otherwise wins over the draft in
		// `current()` and the step would be invisible (and reverted on blur).
		raw[cell] = formatDisplay(next, kind);
	}

	function onArrow(event: KeyboardEvent, cell: CellKey, kind: OpticalInputKind, eye: 'od' | 'oi') {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
		event.preventDefault();
		step(cell, kind, eye, event.key === 'ArrowUp' ? 1 : -1);
	}

	const EYE_LABEL = { od: 'OD · derecho', oi: 'OI · izquierdo' } as const;

	function blurFormat(cell: CellKey, kind: OpticalInputKind, eye: 'od' | 'oi'): void {
		const target = eye === 'od' ? od : oi;
		const key = fieldFor(kind, cell) as keyof LensEditorEyeDraft;
		const parsed = formatOpticalInput(raw[cell] ?? '', kind);
		raw[cell] = parsed;
		(target[key] as number | null) = parsed === '' ? null : Number(parsed);
	}

	/** Spanish field names for aria-labels. */
	const FIELD_LABEL: Partial<Record<keyof LensEditorEyeDraft, string>> = {
		sphere: 'Esfera',
		cylinder: 'Cilindro',
		axis: 'Eje',
		addition: 'Adición',
		altura: 'Altura',
		dp: 'DP',
		dnp: 'DNP'
	};

	/**
	 * DP is ONE value («distancia pupilar» total, single DB column so it
	 * persists from the OD eye): both cells read and write `od.dp` so they stay
	 * an exact mirror — editing the OI cell never gets silently dropped.
	 * Shared raw key `dp` keeps both inputs on the same cached text.
	 */
	function stepDp(dir: 1 | -1): void {
		const next = stepOpticalValue(Number(od.dp ?? 0), 'mm', dir);
		od.dp = next;
		raw['dp'] = formatDisplay(next, 'mm');
	}

	function blurDp(): void {
		const parsed = formatOpticalInput(raw['dp'] ?? '', 'mm');
		raw['dp'] = parsed;
		od.dp = parsed === '' ? null : Number(parsed);
	}

	/** Reset any in-progress raw text so external draft writes (e.g. Copy
	OD→OI) repaint their values instead of being hidden by stale raw. */
	function resetRaw(): void {
		raw = {};
	}
</script>

<!-- DP cell: OD and OI share the single «distancia pupilar» value (od.dp). -->
{#snippet dpCell(eye: 'od' | 'oi', warnMissing?: boolean)}
	<input
		type="text"
		inputmode="decimal"
		autocomplete="off"
		value={raw['dp'] ?? formatDisplay(od.dp, 'mm')}
		disabled={eye === 'od' ? !od.enabled : !oi.enabled}
		onfocus={(event) => {
			raw['dp'] = event.currentTarget.value;
			event.currentTarget.select();
		}}
		oninput={(event) => {
			raw['dp'] = event.currentTarget.value;
			const parsed = event.currentTarget.value === '' ? null : Number(event.currentTarget.value);
			od.dp = parsed != null && !Number.isNaN(parsed) ? parsed : null;
		}}
		onblur={blurDp}
		onkeydown={(event) => {
			if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			event.preventDefault();
			stepDp(event.key === 'ArrowUp' ? 1 : -1);
		}}
		placeholder="—"
		aria-invalid={warnMissing === true && od.dp == null}
		aria-label={EYE_LABEL[eye] + ' ' + (FIELD_LABEL.dp ?? 'DP')}
		class={`tabular h-8 w-[88px] rounded-lg border bg-white text-center text-[13px] text-brand-navy outline-transparent transition focus:outline-2 focus:outline-brand-blue disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant ${
			warnMissing === true && od.dp == null
				? 'border-warning bg-[#fffaf0]'
				: 'border-outline-variant'
		}`}
	/>
{/snippet}

{#snippet headerCell(eye: 'od' | 'oi', dotClass: string)}
	<div class="flex h-7 items-center justify-center gap-1">
		<span class={`h-2.5 w-2.5 rounded-full ${dotClass}`}></span>
		<span class="font-heading text-[14px] font-bold text-brand-navy"
			>{eye === 'od' ? 'OD' : 'OI'}</span
		>
		{#if eye === 'od'}
			{#snippet odSwitch({ props }: { props: Record<string, unknown> })}
				<input
					{...props}
					type="checkbox"
					bind:checked={od.enabled}
					aria-label="Ojo derecho lleva receta"
					class="relative h-[18px] w-[30px] cursor-pointer appearance-none rounded-full bg-outline-variant transition-colors before:absolute before:top-0.5 before:left-0.5 before:h-[14px] before:w-[14px] before:rounded-full before:bg-white before:transition-transform checked:bg-brand-blue checked:before:translate-x-[12px]"
				/>
			{/snippet}
			<TriggerTooltip
				text="Ojo derecho: activo si lleva receta, apágalo si es plano"
				side="bottom"
				trigger={odSwitch}
			/>
			{#snippet odStatus({ props }: { props: Record<string, unknown> })}
				<span
					{...props}
					role="img"
					aria-label={status.od.label}
					class={`grid h-5 w-5 place-items-center rounded-full ${status.od.tone === 'ok' ? 'bg-success-container text-on-success-container' : status.od.tone === 'w' ? 'bg-warning-container text-on-warning-container' : 'bg-surface-container-high text-on-surface-variant'}`}
				>
					{#if status.od.tone === 'ok'}
						<Check class="h-3 w-3" />
					{:else if status.od.tone === 'w'}
						<TriangleAlert class="h-3 w-3" />
					{:else}
						<span class="text-[11px] font-bold">–</span>
					{/if}
				</span>
			{/snippet}
			<TriggerTooltip text={status.od.label} side="bottom" trigger={odStatus} />
		{:else}
			{#snippet oiSwitch({ props }: { props: Record<string, unknown> })}
				<input
					{...props}
					type="checkbox"
					bind:checked={oi.enabled}
					aria-label="Ojo izquierdo lleva receta"
					class="relative h-[18px] w-[30px] cursor-pointer appearance-none rounded-full bg-outline-variant transition-colors before:absolute before:top-0.5 before:left-0.5 before:h-[14px] before:w-[14px] before:rounded-full before:bg-white before:transition-transform checked:bg-brand-blue checked:before:translate-x-[12px]"
				/>
			{/snippet}
			<TriggerTooltip
				text="Ojo izquierdo: activo si lleva receta, apágalo si es plano"
				side="bottom"
				trigger={oiSwitch}
			/>
			{#snippet oiStatus({ props }: { props: Record<string, unknown> })}
				<span
					{...props}
					role="img"
					aria-label={status.oi.label}
					class={`grid h-5 w-5 place-items-center rounded-full ${status.oi.tone === 'ok' ? 'bg-success-container text-on-success-container' : status.oi.tone === 'w' ? 'bg-warning-container text-on-warning-container' : 'bg-surface-container-high text-on-surface-variant'}`}
				>
					{#if status.oi.tone === 'ok'}
						<Check class="h-3 w-3" />
					{:else if status.oi.tone === 'w'}
						<TriangleAlert class="h-3 w-3" />
					{:else}
						<span class="text-[11px] font-bold">–</span>
					{/if}
				</span>
			{/snippet}
			<TriggerTooltip text={status.oi.label} side="bottom" trigger={oiStatus} />
		{/if}
	</div>
{/snippet}

{#snippet rowLabel(name: string, abbr: string, tooltip: string)}
	{#snippet labelTrigger({ props }: { props: Record<string, unknown> })}
		<span
			{...props}
			class="flex cursor-help flex-col text-[13px] leading-[1.1] font-semibold text-brand-navy"
		>
			{name}
			<span class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
				{abbr}
			</span>
		</span>
	{/snippet}
	<TriggerTooltip text={tooltip} side="top" trigger={labelTrigger} />
{/snippet}

{#snippet numInput(cell: string, kind: OpticalInputKind, eye: 'od' | 'oi', warnMissing?: boolean)}
	{@const val = eye === 'od' ? od : oi}
	{@const field = fieldFor(kind, cell)}
	{@const disabled = eye === 'od' ? !od.enabled : !oi.enabled}
	{@const cellKey = cell as CellKey}
	<input
		type="text"
		inputmode="decimal"
		autocomplete="off"
		value={current(cellKey, val, field, kind)}
		{disabled}
		onfocus={(event) => {
			const cellKey = cell as CellKey;
			raw[cellKey] = event.currentTarget.value;
			event.currentTarget.select();
		}}
		oninput={(event) => {
			raw[cellKey] = event.currentTarget.value;
			const parsed = event.currentTarget.value === '' ? null : Number(event.currentTarget.value);
			(val[field] as number | null) = parsed != null && !Number.isNaN(parsed) ? parsed : null;
		}}
		onblur={() => blurFormat(cellKey, kind, eye)}
		onkeydown={(event) => onArrow(event, cellKey, kind, eye)}
		placeholder="—"
		aria-invalid={warnMissing === true && val[field] == null}
		aria-label={EYE_LABEL[eye] + ' ' + (FIELD_LABEL[field] ?? String(field))}
		class={`tabular h-8 w-[88px] rounded-lg border bg-white text-center text-[13px] text-brand-navy outline-transparent transition focus:outline-2 focus:outline-brand-blue disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant ${
			warnMissing === true && val[field] == null
				? 'border-warning bg-[#fffaf0]'
				: 'border-outline-variant'
		}`}
	/>
{/snippet}

<div class="flex flex-wrap items-start gap-x-6 gap-y-3">
	<!-- GRADUACIÓN -->
	<div class="grid grid-cols-[90px_88px_30px_88px] items-center gap-y-2">
		<span class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
			Graduación
		</span>
		{@render headerCell('od', 'bg-brand-blue')}
		<button
			type="button"
			onclick={() => {
				// Drop stale raw text: the OI cells must repaint the copied values.
				resetRaw();
				onCopy();
			}}
			aria-label="Copiar OD a OI"
			class="mx-auto grid h-[30px] w-[30px] place-items-center rounded-full border border-outline-variant bg-white text-brand-navy transition hover:bg-brand-navy hover:text-white"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg
			>
		</button>
		{@render headerCell('oi', 'bg-brand-navy')}

		{@render rowLabel('Esfera', 'ESF', 'Esfera: dioptrías de miopía o hipermetropía (+ / −)')}
		{@render numInput('od.esf', 'esf', 'od')}
		<span></span>
		{@render numInput('oi.esf', 'esf', 'oi')}

		{@render rowLabel('Cilindro', 'CIL', 'Cilindro: corrección del astigmatismo')}
		{@render numInput('od.cil', 'cil', 'od')}
		<span></span>
		{@render numInput('oi.cil', 'cil', 'oi')}

		{@render rowLabel('Eje', 'EJE °', 'Eje del cilindro, de 0° a 180°')}
		{@render numInput('od.eje', 'eje', 'od')}
		<span></span>
		{@render numInput('oi.eje', 'eje', 'oi')}

		{#if requiresAddition}
			{@render rowLabel('Adición', 'ADD', 'Adición para visión cercana (progresivo / bifocal)')}
			{@render numInput('od.add', 'add', 'od')}
			<span></span>
			{@render numInput('oi.add', 'add', 'oi')}
		{/if}
	</div>

	<div class="w-px self-stretch bg-surface-container-highest"></div>

	<!-- MEDIDAS · MM -->
	<div class="grid grid-cols-[90px_88px_88px] items-center gap-x-2 gap-y-2">
		<span class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
			Medidas · mm
		</span>
		<span class="flex h-7 items-center justify-center gap-1">
			<span class="h-2.5 w-2.5 rounded-full bg-brand-blue"></span>
			<span class="font-heading text-[14px] font-bold text-brand-navy">OD</span>
		</span>
		<span class="flex h-7 items-center justify-center gap-1">
			<span class="h-2.5 w-2.5 rounded-full bg-brand-navy"></span>
			<span class="font-heading text-[14px] font-bold text-brand-navy">OI</span>
		</span>

		{#if requiresAddition}
			{@render rowLabel(
				'Altura',
				'ALT',
				'Altura de montaje: del centro de la pupila al borde inferior de la montura'
			)}
			{@render numInput(
				'od.altura',
				'mm',
				'od',
				status.od.tone === 'w' && status.od.label === 'Faltan medidas'
			)}
			{@render numInput(
				'oi.altura',
				'mm',
				'oi',
				status.oi.tone === 'w' && status.oi.label === 'Faltan medidas'
			)}
		{/if}

		{@render rowLabel(
			'Pupilar',
			'DP',
			'DP: distancia pupilar — se guarda desde el ojo derecho y se refleja en ambos (un solo valor)'
		)}
		{@render dpCell('od')}
		{@render dpCell('oi')}

		{@render rowLabel('Naso-pupilar', 'DNP', 'DNP: del puente nasal al centro de la pupila')}
		{@render numInput(
			'od.dnp',
			'mm',
			'od',
			status.od.tone === 'w' && status.od.label === 'Faltan medidas'
		)}
		{@render numInput(
			'oi.dnp',
			'mm',
			'oi',
			status.oi.tone === 'w' && status.oi.label === 'Faltan medidas'
		)}
	</div>
</div>
