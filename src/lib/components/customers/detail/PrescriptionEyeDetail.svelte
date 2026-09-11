<script lang="ts">
	import { formatAxis, formatOpticalValue } from '$lib/utils';

	interface Props {
		side: 'OD' | 'OS';
		sphere: number | null | undefined;
		cylinder: number | null | undefined;
		axis: number | null | undefined;
		addition: number | null | undefined;
	}

	let { side, sphere, cylinder, axis, addition }: Props = $props();

	const isOD = $derived(side === 'OD');
</script>

<div class="rounded-xl bg-surface-container-lowest p-5">
	<div class="mb-3 flex items-center gap-2.5">
		<div
			class="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold {isOD
				? 'bg-brand-navy text-white'
				: 'bg-brand-blue text-white'}"
		>
			{side}
		</div>
		<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
			>{isOD ? 'Ojo Derecho (OD)' : 'Ojo Izquierdo (OS)'}</span
		>
	</div>
	<div class="grid grid-cols-4 gap-3 text-xs">
		<div>
			<span class="font-semibold tracking-wider text-on-surface-variant uppercase">Esfera</span>
			<p class="mt-0.5 font-mono text-base text-on-surface">
				{formatOpticalValue(sphere)}
			</p>
		</div>
		<div>
			<span class="font-semibold tracking-wider text-on-surface-variant uppercase">Cilindro</span>
			<p class="mt-0.5 font-mono text-base text-on-surface">
				{formatOpticalValue(cylinder)}
			</p>
		</div>
		<div>
			<span class="font-semibold tracking-wider text-on-surface-variant uppercase">Eje</span>
			<p class="mt-0.5 font-mono text-base text-on-surface">
				{formatAxis(axis)}
			</p>
		</div>
		<div>
			<span class="font-semibold tracking-wider text-on-surface-variant uppercase">Adición</span>
			<p class="mt-0.5 font-mono text-base text-on-surface">
				{formatOpticalValue(addition)}
			</p>
		</div>
	</div>
</div>
