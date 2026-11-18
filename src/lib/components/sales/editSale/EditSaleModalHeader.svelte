<script lang="ts">
	import { X } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';

	interface Props {
		orderNumber: number;
		customer: {
			firstName?: string | null;
			lastName?: string | null;
			idNumber?: string | null;
		} | null;
		isCashea: boolean;
		saving: boolean;
		onClose: () => void;
		/** Generalización quotes: título y etiqueta del chip. */
		title?: string;
		numberLabel?: string;
		/** Sustantivo de la entidad para los textos de Cashea ("venta"/"presupuesto"). */
		entityNoun?: string;
	}

	let {
		orderNumber,
		customer,
		isCashea = $bindable(),
		saving,
		onClose,
		title = 'Modificar orden',
		numberLabel,
		entityNoun = 'venta'
	}: Props = $props();

	let clicked = $state(false);

	const customerName = $derived(
		[customer?.firstName, customer?.lastName].filter(Boolean).join(' ')
	);
	const subtitle = $derived(
		[customerName, customer?.idNumber].filter(Boolean).join(' · ') || 'Sin cliente'
	);
	const orderId = $derived(numberLabel ?? `#${String(orderNumber).padStart(4, '0')}`);
	const tooltipText = $derived(
		isCashea
			? `Este ${entityNoun} está marcado como compra con Cashea. Clic para quitar la marca.`
			: `Clic si el cliente pagó con Cashea. Queda registrado en el ${entityNoun}.`
	);

	function toggleCashea() {
		if (!saving && !clicked) clicked = true;
		isCashea = !isCashea;
	}
</script>

<header
	class="header relative flex min-h-[68px] items-center gap-3 overflow-hidden bg-brand-navy px-5 py-2.5 text-white"
>
	<!-- Brand decorative diagonals (aria-hidden) -->
	<span
		aria-hidden="true"
		class="pointer-events-none absolute top-[-10px] right-[340px] bottom-[-10px] w-10 -skew-x-[20deg] bg-brand-blue"
	></span>
	<span
		aria-hidden="true"
		class="pointer-events-none absolute top-[-10px] right-[394px] bottom-[-10px] w-3 -skew-x-[20deg] bg-brand-gold"
	></span>

	<div class="title-block relative z-[1] min-w-0 flex-1">
		<h1
			class="font-heading flex flex-wrap items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"
		>
			{title}
			<span class="rounded-[4px] bg-brand-blue px-2 py-px text-[13px] font-bold text-brand-navy">
				{orderId}
			</span>
		</h1>
		<p class="mt-0.5 truncate text-[13px] text-[#b8c4de]">{subtitle}</p>
	</div>

	{#snippet casheaTrigger({ props }: { props: Record<string, unknown> })}
		<button
			{...props}
			type="button"
			role="switch"
			aria-checked={isCashea}
			onclick={toggleCashea}
			class={`cashea-toggle group flex items-center gap-2.5 rounded-xl border py-1.5 pr-3.5 pl-2 text-left transition-all duration-200 ${
				isCashea
					? 'border-brand-gold bg-brand-gold text-brand-navy'
					: 'border-white/30 bg-white/8 text-white'
			}`}
			data-clicked={clicked}
			onanimationend={() => (clicked = false)}
		>
			<span
				class={`flex shrink-0 transition-all ${clicked ? 'cashea-logo-pop' : ''} ${isCashea ? 'opacity-100' : 'opacity-55 grayscale'}`}
			>
				<CasheaIsotipo width={34} height={34} />
			</span>
			<span class="flex flex-col gap-px leading-[1.15]">
				<span class="text-[13px] font-bold">{isCashea ? 'Compra con Cashea' : 'Sin Cashea'}</span>
				<span class={`text-[12px] ${isCashea ? 'text-on-secondary' : 'text-[#b8c4de]'}`}>
					{isCashea ? 'Sí · clic para quitar' : 'No · clic para marcar'}
				</span>
			</span>
		</button>
	{/snippet}

	<TriggerTooltip text={tooltipText} side="bottom" trigger={casheaTrigger} />

	<button
		type="button"
		onclick={onClose}
		disabled={saving}
		aria-label="Cerrar"
		class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/30 transition-colors hover:bg-white/25 disabled:opacity-40"
	>
		<X class="h-[18px] w-[18px]" />
	</button>
</header>

<style>
	/* Cashea feedback: golden ring pulse + logo spin (600 / 550 ms), disabled for reduced motion */
	@keyframes cashea-ring {
		from {
			box-shadow: 0 0 0 0 rgba(252, 208, 30, 0.7);
		}
		to {
			box-shadow: 0 0 0 12px rgba(252, 208, 30, 0);
		}
	}
	@keyframes cashea-spin {
		50% {
			transform: rotate(180deg) scale(1.25);
		}
		to {
			transform: rotate(360deg);
		}
	}
	button[data-clicked='true'] {
		animation: cashea-ring 0.6s cubic-bezier(0.25, 1, 0.5, 1);
	}
	button[data-clicked='true'] .cashea-logo-pop {
		animation: cashea-spin 0.55s cubic-bezier(0.25, 1, 0.5, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		button[data-clicked='true'],
		button[data-clicked='true'] .cashea-logo-pop {
			animation: none;
		}
	}

	/* Móvil (<700): el título y el toggle Cashea no deben solaparse.
	   Grid de 2 columnas: título | X en la fila 1, toggle a la derecha abajo. */
	@media (max-width: 700px) {
		.header {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			row-gap: 10px;
		}
		.title-block {
			grid-column: 1;
			grid-row: 1;
		}
		.title-block h1 {
			font-size: 17px;
		}
		.header :global(.cashea-toggle) {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-self: end;
		}
		.header > button[aria-label='Cerrar'] {
			grid-column: 2;
			grid-row: 1;
		}
	}
</style>
