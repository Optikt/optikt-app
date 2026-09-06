<script lang="ts">
	import { PaymentMethodPills } from '$lib/components/ui';
	import {
		PAYMENT_CURRENCY_GROUPS,
		PAYMENT_METHOD_ICONS,
		PAYMENT_METHOD_LABELS,
		type PaymentMethod
	} from '$lib/shared/enums';

	interface Props {
		currencyKey: string | null;
		rail: PaymentMethod | null;
		railsByCurrency: Record<string, PaymentMethod[]>;
		onSelectCurrency: (key: string) => void;
		onSelectRail: (method: PaymentMethod) => void;
	}

	let { currencyKey, rail, railsByCurrency, onSelectCurrency, onSelectRail }: Props = $props();

	const currencyMethods = PAYMENT_CURRENCY_GROUPS.map((g) => g.key);
	const currencyLabels = Object.fromEntries(PAYMENT_CURRENCY_GROUPS.map((g) => [g.key, g.label]));
</script>

<div>
	<p class="mb-2.5 text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
		Moneda / tasa
	</p>
	<PaymentMethodPills
		methods={currencyMethods}
		labels={currencyLabels}
		selected={currencyKey}
		onSelect={(key) => onSelectCurrency(key as string)}
	/>
</div>

{#if currencyKey}
	<div>
		<p class="mb-2.5 text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">Método</p>
		<PaymentMethodPills
			methods={railsByCurrency[currencyKey]}
			labels={PAYMENT_METHOD_LABELS}
			selected={rail}
			onSelect={(m) => onSelectRail(m as PaymentMethod)}
			icons={PAYMENT_METHOD_ICONS}
		/>
	</div>
{/if}
