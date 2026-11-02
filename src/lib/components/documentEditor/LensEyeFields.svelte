<script lang="ts">
	import type { LensEditorEyeDraft, LensEditorFieldErrors } from './types';

	interface Props {
		eye: LensEditorEyeDraft;
		prefix: 'od' | 'os';
		showAddition: boolean;
		statusLabel: string;
		statusClass: string;
		errors: LensEditorFieldErrors;
	}

	let {
		eye = $bindable(),
		prefix,
		showAddition,
		statusLabel,
		statusClass,
		errors
	}: Props = $props();

	const eyeLabel = $derived(prefix === 'od' ? 'OD · derecho' : 'OI · izquierdo');
	const dotClass = $derived(prefix === 'od' ? 'bg-brand-blue' : 'bg-brand-navy');

	const eyeErrors = $derived(
		[
			prefix === 'od' ? errors.odSphere : errors.osSphere,
			prefix === 'od' ? errors.odCylinder : errors.osCylinder,
			prefix === 'od' ? errors.odAxis : errors.osAxis,
			prefix === 'od' ? errors.odAddition : errors.osAddition,
			prefix === 'od' ? errors.odAltura : errors.osAltura
		].filter((message): message is string => Boolean(message))
	);

	function invalid(field: 'sphere' | 'cylinder' | 'axis' | 'addition' | 'altura'): boolean {
		const map = {
			sphere: prefix === 'od' ? errors.odSphere : errors.osSphere,
			cylinder: prefix === 'od' ? errors.odCylinder : errors.osCylinder,
			axis: prefix === 'od' ? errors.odAxis : errors.osAxis,
			addition: prefix === 'od' ? errors.odAddition : errors.osAddition,
			altura: prefix === 'od' ? errors.odAltura : errors.osAltura
		};
		return Boolean(map[field]);
	}

	const inputBase =
		'flex h-8 items-center gap-1 rounded-md border bg-white px-2 transition focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20 dark:bg-slate-800';
	const inputOk = 'border-outline-variant/70 dark:border-slate-600';
	const inputBad = 'border-red-400';
</script>

<div
	class="rounded-[10px] border border-outline-variant/60 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800"
	class:opacity-90={!eye.enabled}
>
	<div class="mb-2 flex items-center justify-between gap-2">
		<span class="flex items-center gap-1.5 text-xs font-bold text-brand-navy dark:text-white">
			<span class="h-2 w-2 rounded-full {dotClass}"></span>
			{eyeLabel}
			<span class="text-[10px] font-medium {statusClass}">{statusLabel}</span>
		</span>
		<label
			class="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
		>
			<input
				type="checkbox"
				bind:checked={eye.enabled}
				class="h-3.5 w-3.5 rounded border-slate-300 accent-brand-blue focus:ring-brand-blue"
			/>
			Con receta
		</label>
	</div>

	<div class={['space-y-1.5', { 'pointer-events-none opacity-45': !eye.enabled }]}>
		<div class="grid grid-cols-3 gap-1.5">
			<label class="flex flex-col gap-0.5">
				<span class="text-[9.5px] font-bold tracking-[0.04em] text-slate-400 uppercase">Esf</span>
				<span class="{inputBase} {invalid('sphere') ? inputBad : inputOk}">
					<input
						type="number"
						step="0.25"
						placeholder="—"
						aria-label="{eyeLabel} esfera"
						bind:value={eye.sphere}
						disabled={!eye.enabled}
						class="w-full bg-transparent text-center text-[13px] text-brand-navy tabular-nums outline-none disabled:cursor-not-allowed dark:text-white"
					/>
				</span>
			</label>
			<label class="flex flex-col gap-0.5">
				<span class="text-[9.5px] font-bold tracking-[0.04em] text-slate-400 uppercase">Cil</span>
				<span class="{inputBase} {invalid('cylinder') ? inputBad : inputOk}">
					<input
						type="number"
						step="0.25"
						placeholder="—"
						aria-label="{eyeLabel} cilindro"
						bind:value={eye.cylinder}
						disabled={!eye.enabled}
						class="w-full bg-transparent text-center text-[13px] text-brand-navy tabular-nums outline-none disabled:cursor-not-allowed dark:text-white"
					/>
				</span>
			</label>
			<label class="flex flex-col gap-0.5">
				<span class="text-[9.5px] font-bold tracking-[0.04em] text-slate-400 uppercase">Eje</span>
				<span class="{inputBase} {invalid('axis') ? inputBad : inputOk}">
					<input
						type="number"
						step="1"
						placeholder="—"
						aria-label="{eyeLabel} eje"
						bind:value={eye.axis}
						disabled={!eye.enabled}
						class="w-full bg-transparent text-center text-[13px] text-brand-navy tabular-nums outline-none disabled:cursor-not-allowed dark:text-white"
					/>
					<span class="text-[11px] text-slate-400">°</span>
				</span>
			</label>
		</div>

		{#if showAddition}
			<div class="grid grid-cols-2 gap-1.5">
				<label class="flex flex-col gap-0.5">
					<span class="text-[9.5px] font-bold tracking-[0.04em] text-slate-400 uppercase"
						>Adición</span
					>
					<span class="{inputBase} {invalid('addition') ? inputBad : inputOk}">
						<input
							type="number"
							step="0.25"
							placeholder="—"
							aria-label="{eyeLabel} adición"
							bind:value={eye.addition}
							disabled={!eye.enabled}
							class="w-full bg-transparent text-center text-[13px] text-brand-navy tabular-nums outline-none disabled:cursor-not-allowed dark:text-white"
						/>
					</span>
				</label>
				<label class="flex flex-col gap-0.5">
					<span class="text-[9.5px] font-bold tracking-[0.04em] text-slate-400 uppercase"
						>Altura</span
					>
					<span class="{inputBase} {invalid('altura') ? inputBad : inputOk}">
						<input
							type="number"
							step="1"
							placeholder="—"
							aria-label="{eyeLabel} altura"
							bind:value={eye.altura}
							disabled={!eye.enabled}
							class="w-full bg-transparent text-center text-[13px] text-brand-navy tabular-nums outline-none disabled:cursor-not-allowed dark:text-white"
						/>
					</span>
				</label>
			</div>
		{/if}

		{#if eyeErrors.length > 0}
			<p class="text-[10.5px] text-red-600 dark:text-red-400">{eyeErrors.join(' · ')}</p>
		{/if}
	</div>
</div>
