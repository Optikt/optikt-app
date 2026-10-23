<script lang="ts">
	import type { LensEditorEyeDraft, LensEditorFieldErrors } from './types';

	interface Props {
		title: string;
		eye: LensEditorEyeDraft;
		prefix: 'od' | 'os';
		showAddition: boolean;
		statusLabel: string;
		statusClass: string;
		errors: LensEditorFieldErrors;
	}

	let {
		title,
		eye = $bindable(),
		prefix,
		showAddition,
		statusLabel,
		statusClass,
		errors
	}: Props = $props();

	const eyeErrors = $derived(
		[
			prefix === 'od' ? errors.odSphere : errors.osSphere,
			prefix === 'od' ? errors.odCylinder : errors.osCylinder,
			prefix === 'od' ? errors.odAxis : errors.osAxis,
			prefix === 'od' ? errors.odAddition : errors.osAddition,
			prefix === 'od' ? errors.odAltura : errors.osAltura
		].filter((message): message is string => Boolean(message))
	);

	function inputClass(invalid: boolean): string {
		const base =
			'w-full rounded-md border bg-white px-2 py-1.5 font-mono text-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white ';
		return invalid
			? base + 'border-red-400 focus:border-red-400 focus:ring-red-200'
			: base +
					'border-slate-300 focus:border-brand-blue focus:ring-brand-blue/20 dark:border-slate-600';
	}
</script>

<div
	class="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-600 dark:bg-slate-900/30"
>
	<div class="flex items-center justify-between gap-2">
		<label class="inline-flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={eye.enabled}
				class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
			/>
			<span class="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</span>
		</label>
		<span class="text-[11px] font-medium {statusClass}">{statusLabel}</span>
	</div>

	<div class={['space-y-1', { 'opacity-50': !eye.enabled }]}>
		<div class={['grid gap-2', { 'grid-cols-5': showAddition, 'grid-cols-3': !showAddition }]}>
			<span class="text-[10px] font-medium text-slate-500">Esf</span>
			<span class="text-[10px] font-medium text-slate-500">Cil</span>
			<span class="text-[10px] font-medium text-slate-500">Eje</span>
			{#if showAddition}
				<span class="text-[10px] font-medium text-slate-500">Add</span>
				<span class="text-[10px] font-medium text-slate-500">Alt</span>
			{/if}
		</div>
		<div class={['grid gap-2', { 'grid-cols-5': showAddition, 'grid-cols-3': !showAddition }]}>
			<input
				type="number"
				step="0.25"
				placeholder="Esf"
				bind:value={eye.sphere}
				disabled={!eye.enabled}
				class={inputClass(!!(prefix === 'od' ? errors.odSphere : errors.osSphere))}
			/>
			<input
				type="number"
				step="0.25"
				placeholder="Cil"
				bind:value={eye.cylinder}
				disabled={!eye.enabled}
				class={inputClass(!!(prefix === 'od' ? errors.odCylinder : errors.osCylinder))}
			/>
			<input
				type="number"
				step="1"
				placeholder="Eje"
				bind:value={eye.axis}
				disabled={!eye.enabled}
				class={inputClass(!!(prefix === 'od' ? errors.odAxis : errors.osAxis))}
			/>
			{#if showAddition}
				<input
					type="number"
					step="0.25"
					placeholder="Add"
					bind:value={eye.addition}
					disabled={!eye.enabled}
					class={inputClass(!!(prefix === 'od' ? errors.odAddition : errors.osAddition))}
				/>
				<input
					type="number"
					step="1"
					placeholder="Alt"
					bind:value={eye.altura}
					disabled={!eye.enabled}
					class={inputClass(!!(prefix === 'od' ? errors.odAltura : errors.osAltura))}
				/>
			{/if}
		</div>
		{#if eyeErrors.length > 0}
			<p class="text-[11px] text-red-600">{eyeErrors.join(' · ')}</p>
		{/if}
	</div>
</div>
