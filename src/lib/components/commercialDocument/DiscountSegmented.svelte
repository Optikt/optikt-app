<script lang="ts">
	/**
	 * Segmented discount type control ($ fixed / % percentage) plus value.
	 * The value stays a single number; the type decides how the adapter reads it.
	 */
	import { DiscountType } from '$lib/shared/enums';

	interface Props {
		type: string;
		value: number;
		onType: (type: string) => void;
		onValue: (value: number) => void;
		maxPercent?: number;
		disabled?: boolean;
		size?: 'sm' | 'md';
	}

	let {
		type,
		value,
		onType,
		onValue,
		maxPercent = 100,
		disabled = false,
		size = 'md'
	}: Props = $props();

	const isSmall = $derived(size === 'sm');

	const isPercent = $derived(type === DiscountType.PERCENTAGE);

	function select(next: string) {
		if (disabled || next === type) return;
		if (next === DiscountType.PERCENTAGE && value > maxPercent) onValue(maxPercent);
		onType(next);
	}
</script>

<div class="flex items-center gap-1.5">
	<div
		class="inline-flex overflow-hidden rounded-lg border border-outline-variant/70 bg-white dark:border-slate-600 dark:bg-slate-800"
		role="group"
		aria-label="Tipo de descuento"
	>
		<button
			type="button"
			class="font-semibold transition {isSmall ? 'h-7 w-9 text-xs' : 'h-9 w-11 text-sm'}"
			class:bg-brand-navy={!isPercent}
			class:text-white={!isPercent}
			class:text-slate-600={isPercent}
			class:hover:bg-surface-container={isPercent}
			class:dark:text-slate-300={isPercent}
			class:dark:hover:bg-slate-700={isPercent}
			onclick={() => select(DiscountType.FIXED)}
			aria-pressed={!isPercent}
			aria-label="Monto fijo"
			{disabled}
		>
			$
		</button>
		<button
			type="button"
			class="border-l border-outline-variant/60 font-semibold transition dark:border-slate-600 {isSmall
				? 'h-7 w-9 text-xs'
				: 'h-9 w-11 text-sm'}"
			class:bg-brand-navy={isPercent}
			class:text-white={isPercent}
			class:text-slate-600={!isPercent}
			class:hover:bg-surface-container={!isPercent}
			class:dark:text-slate-300={!isPercent}
			class:dark:hover:bg-slate-700={!isPercent}
			onclick={() => select(DiscountType.PERCENTAGE)}
			aria-pressed={isPercent}
			aria-label="Porcentaje"
			{disabled}
		>
			%
		</button>
	</div>

	<input
		type="number"
		class="h-9 w-24 rounded-lg border border-outline-variant/70 bg-white px-2.5 text-sm tabular-nums transition outline-none placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:bg-surface-container dark:border-slate-600 dark:bg-slate-800 dark:text-white"
		min="0"
		max={isPercent ? maxPercent : undefined}
		step={isPercent ? 1 : 0.01}
		{value}
		{disabled}
		oninput={(event) => {
			const raw = Number.parseFloat(event.currentTarget.value);
			if (Number.isNaN(raw) || raw < 0) {
				onValue(0);
				return;
			}
			onValue(isPercent ? Math.min(raw, maxPercent) : raw);
		}}
		aria-label={isPercent ? 'Porcentaje de descuento' : 'Monto de descuento'}
	/>
</div>
