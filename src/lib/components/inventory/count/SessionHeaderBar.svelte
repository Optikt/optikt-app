<script lang="ts">
	import { ArrowLeft, RefreshCw } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import ResponsibleStack from './ui/ResponsibleStack.svelte';
	import CountButton from './ui/CountButton.svelte';

	interface Props {
		title: string;
		scope: string;
		phase: 1 | 2 | 3;
		progress: { verified: number; total: number };
		responsibles: Array<{
			id: number;
			userId: string | null;
			displayName: string;
			isExternal: boolean;
		}>;
		canManage: boolean;
		ctaLabel: string;
		ctaDisabledReason?: string | null;
		onBack: () => void;
		onOpenPhase: () => void;
		/** Toast con el motivo cuando el CTA está bloqueado (aria-disabled). */
		onCtaBlocked?: () => void;
		/** Clic en un paso del stepper (navega entre fases; nunca cierra). */
		onStepClick: (step: 1 | 2 | 3) => void;
		onOpenResponsibles: () => void;
		onCancel?: () => void;
		/** Refrescar la sesión: recarga líneas/stock esperado (ventas registradas mid-session). */
		onRefresh?: () => void;
		isRefreshing?: boolean;
	}

	let {
		title,
		scope,
		phase,
		progress,
		responsibles,
		canManage,
		ctaLabel,
		ctaDisabledReason = null,
		onBack,
		onOpenPhase,
		onCtaBlocked,
		onStepClick,
		onOpenResponsibles,
		onCancel,
		onRefresh,
		isRefreshing = false
	}: Props = $props();

	const steps = [1, 2, 3] as const;
	const labels = ['Contar', 'Revisar', 'Cerrar'];
	// Spec 7.5 / mockup stT: qué hace cada paso.
	const stepHints = [
		'Ingresa lo contado ítem por ítem.',
		'Recuenta y ajusta diferencias. Se habilita al contar todo.',
		'Cierra y genera el informe. El cierre es con el botón de la derecha.'
	];
	const progressPercent = $derived(
		progress.total === 0 ? 0 : Math.round((progress.verified / progress.total) * 100)
	);
</script>

<header
	class="relative flex flex-wrap items-center gap-2.5 bg-brand-navy px-4 py-2 pl-[26px] text-white"
>
	<div
		class="absolute top-0 bottom-0 w-[7px] bg-brand-blue"
		style="left:6px;transform:skewX(-20deg)"
		aria-hidden="true"
	></div>
	<div
		class="absolute top-0 bottom-0 w-[4px] bg-brand-gold"
		style="left:16px;transform:skewX(-20deg)"
		aria-hidden="true"
	></div>

	<TriggerTooltip
		title="Guardar y salir"
		text="El progreso se guarda por línea. Puedes retomar luego."
		side="bottom"
	>
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				aria-label="Volver a la cobertura · el progreso se guarda"
				class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
				onclick={onBack}
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
		{/snippet}
	</TriggerTooltip>

	{#if phase !== 3 && onRefresh}
		<TriggerTooltip
			title="Actualizar datos"
			text="Recarga el stock esperado y las líneas por si registraste ventas u otros movimientos durante el conteo."
			side="bottom"
		>
			{#snippet trigger({ props })}
				<button
					{...props}
					type="button"
					aria-label="Actualizar datos de la sesión"
					class="rounded-lg p-1.5 transition-colors hover:bg-white/10"
					onclick={onRefresh}
				>
					<RefreshCw class={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
				</button>
			{/snippet}
		</TriggerTooltip>
	{/if}

	<h2 class="font-heading text-sm font-bold tracking-tight">
		{title} <span class="opacity-70">· {scope}</span>
	</h2>

	<ResponsibleStack
		{responsibles}
		editable={canManage && phase !== 3}
		tooltipTitle="Responsables del conteo"
		onOpenEdit={onOpenResponsibles}
	/>

	{#if phase !== 3}
		<nav aria-label="Fases del conteo" class="flex gap-1">
			{#each steps as step, index (step)}
				<TriggerTooltip title={`${step} ${labels[index]!}`} text={stepHints[index]} side="bottom">
					{#snippet trigger({ props })}
						<button
							{...props}
							type="button"
							aria-current={phase === step ? 'step' : undefined}
							class={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
								phase === step ? 'bg-brand-blue text-brand-navy' : 'text-[#aab4cf] hover:text-white'
							}`}
							onclick={() => onStepClick(step)}
						>
							{step}
							{labels[index]}
						</button>
					{/snippet}
				</TriggerTooltip>
			{/each}
		</nav>
	{/if}

	<span class="flex-1"></span>

	{#if phase !== 3}
		<span class="text-sm tabular-nums opacity-90">
			{progress.verified}/{progress.total}
		</span>
		<span class="h-1.5 w-[90px] overflow-hidden rounded-full bg-[#38466b]">
			<span
				class="block h-full rounded-full bg-brand-blue transition-[width] duration-250"
				style={`width:${progressPercent}%`}
			></span>
		</span>
	{/if}

	<CountButton
		variant="gold"
		class="!px-3 !py-1.5"
		disabled={Boolean(ctaDisabledReason)}
		disabledTooltip={ctaDisabledReason ?? undefined}
		onclick={onOpenPhase}
		onBlockedClick={onCtaBlocked}
	>
		{#snippet child()}{ctaLabel}{/snippet}
	</CountButton>

	{#if canManage && phase !== 3 && onCancel}
		<TriggerTooltip title="Cancelar conteo" text="Pide un motivo. No ajusta stock." side="bottom">
			{#snippet trigger({ props })}
				<button
					{...props}
					type="button"
					aria-label="Cancelar conteo"
					class="rounded-lg px-1.5 py-1.5 text-lg transition-colors hover:bg-white/10"
					onclick={onCancel}
				>
					⋯
				</button>
			{/snippet}
		</TriggerTooltip>
	{/if}
</header>
