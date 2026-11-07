<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
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
		onOpenResponsibles: () => void;
		onCancel?: () => void;
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
		onOpenResponsibles,
		onCancel
	}: Props = $props();

	const steps = [1, 2, 3];
	const labels = ['Contar', 'Revisar', 'Cerrar'];
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
				<TriggerTooltip text={`${step} ${labels[index]!}`} side="bottom">
					{#snippet trigger({ props })}
						<button
							{...props}
							type="button"
							aria-current={phase === step ? 'step' : undefined}
							class={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
								phase === step ? 'bg-brand-blue text-brand-navy' : 'text-[#aab4cf] hover:text-white'
							}`}
							onclick={() => phase !== step && onOpenPhase()}
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
