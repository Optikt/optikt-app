<script lang="ts">
	import { ArrowDown, ArrowUp, Check, CheckCheck, Circle } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { diffGravity, type CountLineCore } from '$lib/shared/inventoryCount';

	interface Props {
		line: CountLineCore;
		diffThresholdUnits: number;
		diffThresholdUsd?: number;
		unitCost?: number | null;
		size?: 'sm' | 'md';
	}

	let {
		line,
		diffThresholdUnits,
		diffThresholdUsd = 0,
		unitCost = null,
		size = 'md'
	}: Props = $props();

	const dimension = $derived(size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3');
	const diff = $derived.by(() => {
		const final = line.recountedStock ?? line.countedStock;
		return final == null ? null : final - line.systemStock;
	});
	const gravity = $derived(diffGravity(line, { diffThresholdUnits, diffThresholdUsd }, unitCost));

	const title = $derived.by(() => {
		if (line.countedStock == null) return 'Pendiente';
		if (line.adjustmentMovementId != null) return 'Ajustado';
		if (diff === 0) return 'Coincide';
		return diff! > 0 ? `Sobran ${diff}` : `Falta ${Math.abs(diff!)}`;
	});
	const body = $derived.by(() => {
		if (line.countedStock == null) return 'Aún sin contar.';
		if (line.adjustmentMovementId != null)
			return 'El stock ya se corrigió con un movimiento vinculado.';
		if (diff === 0) return 'Lo contado es igual al sistema.';
		if (gravity === 'high') return 'Sobre el umbral: requiere recuento antes de cerrar.';
		return `Bajo el umbral de ${diffThresholdUnits} unidades.`;
	});

	const { icon: Icon, tone } = $derived.by(() => {
		if (line.countedStock == null) {
			return { icon: Circle, tone: 'text-outline' };
		}
		if (line.adjustmentMovementId != null) {
			return { icon: CheckCheck, tone: 'text-[#1e4f5e]' };
		}
		if (diff === 0) return { icon: Check, tone: 'text-success' };
		if (gravity === 'high') {
			return { icon: diff! > 0 ? ArrowUp : ArrowDown, tone: 'text-on-error-container' };
		}
		return { icon: diff! > 0 ? ArrowUp : ArrowDown, tone: 'text-on-warning-container' };
	});
</script>

<TriggerTooltip {title} text={body}>
	{#snippet trigger({ props })}
		<button
			type="button"
			{...props}
			aria-label={title}
			class={`inline-flex items-center justify-center ${tone} p-0`}
		>
			<Icon class={dimension} aria-hidden="true" />
		</button>
	{/snippet}
</TriggerTooltip>
