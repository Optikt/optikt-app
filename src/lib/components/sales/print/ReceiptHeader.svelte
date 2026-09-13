<script lang="ts">
	import { Isotipo } from '$lib/components';

	interface Props {
		businessName: string;
		businessLogo: string | null;
		printLogoPrimary: string;
		printLogoSecondary: string;
		businessRif: string | null;
		businessAddress: string | null;
		businessContactPhone: string | null;
		formattedOrderNumber: string;
		receiptDateLabel: string;
		customerName: string;
		customerDocument: string;
		customerPhone: string | null;
		sellerName: string;
	}

	let {
		businessName,
		businessLogo,
		printLogoPrimary,
		printLogoSecondary,
		businessRif,
		businessAddress,
		businessContactPhone,
		formattedOrderNumber,
		receiptDateLabel,
		customerName,
		customerDocument,
		customerPhone,
		sellerName
	}: Props = $props();
</script>

<header class="border-b-[0.5px] border-[#ddd]">
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex items-start gap-2">
				{#if businessLogo}
					<img
						src={businessLogo}
						alt={`Logo de ${businessName}`}
						class="h-8 w-auto shrink-0 object-contain grayscale"
					/>
				{:else}
					<Isotipo
						primaryColor={printLogoPrimary}
						secondaryColor={printLogoSecondary}
						class="h-8 w-auto shrink-0"
					/>
				{/if}
				<div class="min-w-0 space-y-0.5">
					<div class="flex items-end gap-x-1">
						<p class="text-[15px] leading-none font-medium text-slate-950">{businessName}</p>
						{#if businessRif}
							<p class="text-[9px] leading-none text-slate-500">RIF: {businessRif}</p>
						{/if}
					</div>
					{#if businessAddress}
						<p class="text-[9px] leading-none text-slate-500">
							{businessAddress}
						</p>
					{/if}
					{#if businessContactPhone}
						<p class="text-[9px] leading-none text-slate-500">
							{businessContactPhone}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="shrink-0 text-right">
			<p class="text-[9px] font-medium tracking-[1px] text-slate-400 uppercase">
				{receiptDateLabel} · RECIBO DE VENTA
			</p>
			<p class="font-mono text-[20px] leading-none font-medium text-slate-950">
				{formattedOrderNumber}
			</p>
		</div>
	</div>
	<div class="mt-1 flex justify-between text-slate-950">
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<p class="text-[12px] font-medium">{customerName}</p>
			<p class="text-[10px] text-slate-500">Cédula/RIF: {customerDocument}</p>
			{#if customerPhone}
				<p class="text-[10px] text-slate-500">Teléfono: {customerPhone}</p>
			{/if}
		</div>
		<div>
			<p class="mt-0.5 text-[10px] text-slate-500">
				<strong> Vendedor: </strong>
				{sellerName}
			</p>
		</div>
	</div>
</header>
