<script lang="ts">
	interface Props {
		show: boolean;
		placeholderRows: readonly number[];
	}

	let { show, placeholderRows }: Props = $props();
</script>

{#if show}
	<section class="receipt-box overflow-hidden rounded-[4px] border-[0.5px] border-[#e0e0e0]">
		<div class="border-b-[0.5px] border-[#eee] px-[9px] py-[5px]">
			<p class="text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
				ABONOS ADICIONALES
			</p>
		</div>

		<table class="w-full border-collapse text-[10px]">
			<colgroup>
				<col class="w-[19%]" />
				<col class="w-[33%]" />
				<col class="w-[16%]" />
				<col class="w-[16%]" />
				<col class="w-[16%]" />
			</colgroup>
			<thead>
				<tr class="border-b-[0.5px] border-[#eee] text-left">
					<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Fecha </th>
					<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400">
						Método / Referencia
					</th>
					<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Monto Bs </th>
					<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Monto $ </th>
					<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Pendiente $ </th>
				</tr>
			</thead>
			<tbody>
				{#each placeholderRows as placeholderRow (placeholderRow)}
					<tr class="border-b-[0.5px] border-[#eee] last:border-b-0">
						<td class="px-2 pt-[8px] pb-[4px] text-[9.5px] text-[#c6c6c6]">__ / __ / ____</td>
						<td class="px-2 pt-[8px] pb-[4px] text-[9px] text-[#ccc]">
							________________________________
						</td>
						<td class="px-2 pt-[8px] pb-[4px] font-mono text-[9px] text-[#ccc] tabular-nums">
							_____________
						</td>
						<td class="px-2 pt-[8px] pb-[4px] font-mono text-[9px] text-[#ccc] tabular-nums">
							_____________
						</td>
						<td class="px-2 pt-[8px] pb-[4px] font-mono text-[9px] text-[#ccc] tabular-nums">
							_____________
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}
