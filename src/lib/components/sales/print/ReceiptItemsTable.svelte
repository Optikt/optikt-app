<script lang="ts">
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import {
		getPrintItemLabel,
		getPrintItemLabelClass,
		getPrintLensRxSummary
	} from '$lib/utils/printDocumentItems';
	import type { RenderedRow } from './receiptData';

	interface Props {
		rows: RenderedRow[];
	}

	let { rows }: Props = $props();
</script>

<section class="receipt-table">
	<table class="w-full border-collapse">
		<colgroup>
			<col class="w-[60%]" />
			<col class="w-[8%]" />
			<col class="w-[16%]" />
			<col class="w-[16%]" />
		</colgroup>
		<thead>
			<tr class="border-b-[0.5px] border-[#ddd] text-left">
				<th class="py-[3px] pr-1 text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase">
					Descripción
				</th>
				<th
					class="py-[3px] pl-1 text-center text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
				>
					Cant.
				</th>
				<th
					class="py-[3px] pl-1 text-right text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
				>
					P. Unit.
				</th>
				<th
					class="py-[3px] pl-1 text-right text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
				>
					Total
				</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr class="border-b-[0.5px] border-[#eee] align-top last:border-b-0">
					<td class="py-[5px] pr-1">
						<p class={getPrintItemLabelClass(row.item)}>
							{getPrintItemLabel(row.item)}
							{#if row.item.itemType === SaleItemType.LENS_PAIR}
								<span class="ml-1 text-[9.5px] font-normal text-slate-500">
									{getPrintLensRxSummary(row.item)}
								</span>
							{/if}
						</p>
					</td>
					<td class="py-[5px] pl-1 text-center font-mono text-[10.5px] tabular-nums">
						{row.item.quantity}
					</td>
					<td class="py-[5px] pl-1 text-right font-mono text-[10.5px] tabular-nums">
						{formatPrice(row.item.unitPrice)}
					</td>
					<td class="py-[5px] pl-1 text-right font-mono text-[10.5px] tabular-nums">
						{formatPrice(row.lineTotal)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
