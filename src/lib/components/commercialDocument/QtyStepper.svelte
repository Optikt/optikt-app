<script lang="ts">
	/**
	 * Accessible quantity stepper (− / editable value / +).
	 * Emits every change through `onChange`; clamps to `[min, max]`.
	 */
	interface Props {
		value: number;
		onChange: (value: number) => void;
		min?: number;
		max?: number;
		small?: boolean;
		disabled?: boolean;
	}

	let { value, onChange, min = 1, max = 99, small = false, disabled = false }: Props = $props();

	function clamp(next: number): number {
		return Math.min(max, Math.max(min, next));
	}

	function step(delta: number) {
		if (disabled) return;
		const next = clamp(value + delta);
		if (next !== value) onChange(next);
	}

	function commit(raw: string) {
		const parsed = Number.parseInt(raw, 10);
		const next = clamp(Number.isNaN(parsed) ? value : parsed);
		onChange(next);
		return next;
	}
</script>

<div
	class="inline-flex items-center overflow-hidden rounded-lg border border-outline-variant/70 bg-white dark:border-slate-600 dark:bg-slate-800"
	role="group"
	aria-label="Cantidad"
>
	<button
		type="button"
		class="flex items-center justify-center text-slate-500 transition hover:bg-surface-container hover:text-brand-navy disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
		class:h-7={small}
		class:w-7={small}
		class:h-9={!small}
		class:w-9={!small}
		onclick={() => step(-1)}
		disabled={disabled || value <= min}
		aria-label="Restar uno"
	>
		<span class="text-lg leading-none">−</span>
	</button>
	<input
		type="text"
		inputmode="numeric"
		class="w-10 border-x border-outline-variant/60 bg-white text-center text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-brand-blue/40 focus:ring-inset disabled:bg-surface-container dark:border-slate-600 dark:bg-slate-800 dark:text-white"
		class:h-7={small}
		class:h-9={!small}
		{disabled}
		{value}
		onchange={(event) => {
			event.currentTarget.value = String(commit(event.currentTarget.value));
		}}
		aria-label="Cantidad"
	/>
	<button
		type="button"
		class="flex items-center justify-center text-slate-500 transition hover:bg-surface-container hover:text-brand-navy disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
		class:h-7={small}
		class:w-7={small}
		class:h-9={!small}
		class:w-9={!small}
		onclick={() => step(1)}
		disabled={disabled || value >= max}
		aria-label="Sumar uno"
	>
		<span class="text-lg leading-none">＋</span>
	</button>
</div>
