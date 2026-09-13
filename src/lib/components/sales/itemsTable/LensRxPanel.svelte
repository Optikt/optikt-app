<script lang="ts">
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import { prescriptionValue } from './itemDisplay';

	interface Props {
		item: SaleItemWithDetails;
	}

	let { item }: Props = $props();
</script>

<div class="px-5 pb-4">
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		<div class="mb-3 flex items-center gap-2">
			<div class="flex h-5 w-5 items-center justify-center rounded bg-slate-200">
				<svg
					class="h-3 w-3 text-slate-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
			</div>
			<span class="text-xs font-bold tracking-widest text-slate-600 uppercase">Prescripción</span>
		</div>

		<div class="grid grid-cols-[40px_repeat(5,minmax(50px,1fr))] gap-x-3 gap-y-2">
			<div></div>
			<span class="text-center text-[10px] font-bold text-slate-500">ESF</span>
			<span class="text-center text-[10px] font-bold text-slate-500">CIL</span>
			<span class="text-center text-[10px] font-bold text-slate-500">EJE</span>
			<span class="text-center text-[10px] font-bold text-slate-500">ADD</span>
			<span class="text-center text-[10px] font-bold text-slate-500">DIP</span>

			<div class="flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
				<span class="text-[11px] font-bold text-slate-600">OD</span>
			</div>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.odSphere)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.odCylinder)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.odAxis)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.odAddition)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>—</span
			>

			<div class="flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500"></span>
				<span class="text-[11px] font-bold text-slate-600">OI</span>
			</div>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.osSphere)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.osCylinder)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.osAxis)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>{prescriptionValue(item.osAddition)}</span
			>
			<span class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
				>—</span
			>
		</div>

		<div class="mt-3 flex gap-6 border-t border-slate-200 pt-3 text-[11px]">
			<span class="text-slate-500"
				>Alt. Montaje OD: <strong class="font-mono text-slate-800">—</strong></span
			>
			<span class="text-slate-500"
				>Alt. Montaje OI: <strong class="font-mono text-slate-800">—</strong></span
			>
		</div>
	</div>
</div>
