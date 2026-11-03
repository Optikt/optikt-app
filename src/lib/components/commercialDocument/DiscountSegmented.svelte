<script lang="ts">
	/**
	 * Segmented discount type control ($ fixed / % percentage) plus value.
	 * The value stays a single number; the type decides how the adapter reads it.
	 * `variant="navy"` renders for the dark footer (ghost white, gold active).
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
		variant?: 'light' | 'navy';
		/** Focus the value input when this prop flips on (e.g. panel just opened). */
		focusOnMount?: boolean;
	}

	let {
		type,
		value,
		onType,
		onValue,
		maxPercent = 100,
		disabled = false,
		size = 'md',
		variant = 'light',
		focusOnMount = false
	}: Props = $props();

	let valueInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (focusOnMount) valueInput?.focus();
	});

	const isSmall = $derived(size === 'sm');
	const isNavy = $derived(variant === 'navy');
	const isPercent = $derived(type === DiscountType.PERCENTAGE);

	const controlHeight = $derived(isSmall ? 'h-7' : 'h-9');
	const controlWidth = $derived(isSmall ? 'w-9' : 'w-11');
	const controlText = $derived(isSmall ? 'text-xs' : 'text-sm');

	// Selected segment; on navy the whole control is gold with navy text.
	const activeClass = $derived(
		isNavy ? 'bg-brand-gold text-brand-navy' : 'bg-brand-navy text-white'
	);
	const inactiveClass = $derived(
		isNavy ? 'bg-transparent text-white' : 'text-slate-600 dark:text-slate-300'
	);
	const inactiveHover = $derived(
		isNavy ? 'hover:bg-white/10' : 'hover:bg-surface-container dark:hover:bg-slate-700'
	);
	// Active-on-navy segments keep a gold hover; on light they darken.
	const activeHover = $derived(isNavy ? 'hover:bg-brand-gold-dark' : '');

	function select(next: string) {
		if (disabled || next === type) return;
		if (next === DiscountType.PERCENTAGE && value > maxPercent) onValue(maxPercent);
		onType(next);
	}
</script>

<div class="flex items-center gap-1.5">
	<div
		class={`inline-flex overflow-hidden rounded-lg border ${isNavy ? 'border-white/35 bg-transparent' : 'border-outline-variant/70 bg-white dark:border-slate-600 dark:bg-slate-800'}`}
		role="group"
		aria-label="Tipo de descuento"
	>
		<button
			type="button"
			class={`${controlHeight} ${controlWidth} font-semibold ${controlText} transition ${isPercent ? inactiveClass : activeClass} ${isPercent ? inactiveHover : activeHover}`}
			onclick={() => select(DiscountType.FIXED)}
			aria-pressed={!isPercent}
			aria-label="Monto fijo"
			{disabled}
		>
			$
		</button>
		<button
			type="button"
			class={`${controlHeight} ${controlWidth} ${controlText} border-l font-semibold transition ${isNavy ? 'border-white/35' : 'border-outline-variant/60 dark:border-slate-600'} ${isPercent ? activeClass : inactiveClass} ${isPercent ? activeHover : inactiveHover}`}
			onclick={() => select(DiscountType.PERCENTAGE)}
			aria-pressed={isPercent}
			aria-label="Porcentaje"
			{disabled}
		>
			%
		</button>
	</div>

	<input
		bind:this={valueInput}
		type="number"
		class={`${controlHeight} ${isSmall ? 'w-[72px]' : 'w-24'} rounded-lg border px-2.5 text-sm tabular-nums transition outline-none placeholder:text-slate-400 focus:ring-2 disabled:bg-surface-container ${isNavy ? 'border-white/35 bg-transparent text-white focus:ring-white/30' : 'border-outline-variant/70 bg-white text-brand-navy focus:border-brand-blue focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white'}`}
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
