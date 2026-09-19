import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { PaymentMethod } from '$lib/shared/enums';
import PaymentRailSection from './PaymentRailSection.svelte';

function props(overrides: Record<string, unknown> = {}) {
	return {
		kind: 'sale' as const,
		rail: PaymentMethod.EFECTIVO_BS,
		variant: 'default' as const,
		paymentDate: '2026-01-15',
		usdFieldValue: '100.00',
		nativeFieldValue: '4000.00',
		nativeLabel: 'Monto Bs',
		nativePrefix: 'Bs.',
		debtBalanceUsd: 100,
		resolvedAmountUsd: 100,
		resolvedUsdDisplay: '$100,00',
		rateContextLine: '40.00 × $100,00',
		bcvRateInput: '40',
		defaultBcvRateInput: '40.00',
		needsSpecificRate: false,
		specificRateLabel: 'Tasa usada (Bs/unidad)',
		specificRateInput: '',
		autoSpecificRate: 0,
		isCasheaSale: false,
		reference: '',
		notes: '',
		referenceLabel: 'Referencia',
		referencePlaceholder: '--',
		referenceRequired: false,
		overpaymentAmount: 0,
		overpaymentDisplay: '$0,00',
		pendingAfterPayment: 0,
		restLabelClass: 'text-success',
		showPurchasePreview: false,
		purchaseNormalized: { amountBs: 0, amountUsdBcv: 0 },
		isNativeSettlement: false,
		amountAppliedToDebt: 0,
		settlementSymbol: '',
		exchangeVariance: 0,
		liveEarlyPaymentSuggestion: null,
		canSubmit: true,
		drawerSubmitLabel: 'Aplicar Pago',
		submitLabel: 'Registrar abono de $100,00',
		onDateInput: () => {},
		onUsdInput: () => {},
		onNativeInput: () => {},
		onBcvRateInput: () => {},
		onSpecificRateInput: () => {},
		onUseRemainingBalance: () => {},
		onReference: () => {},
		onNotes: () => {},
		onSubmit: () => {},
		...overrides
	};
}

test('shows the amount submit label and disables the button when invalid', async () => {
	const screen = await render(PaymentRailSection, props({ canSubmit: false }));

	await expect
		.element(screen.getByRole('button', { name: 'Registrar abono de $100,00' }))
		.toBeDisabled();
});

test('uses the drawer label and enables submit when valid', async () => {
	const screen = await render(PaymentRailSection, props({ variant: 'drawer' }));

	await expect.element(screen.getByRole('button', { name: 'Aplicar Pago' })).toBeEnabled();
});

test('warns when the amount exceeds the debt', async () => {
	const screen = await render(
		PaymentRailSection,
		props({ overpaymentAmount: 25, overpaymentDisplay: '$25,00' })
	);

	await expect.element(screen.getByText('El monto supera la deuda.')).toBeVisible();
	await expect.element(screen.getByText('Excedente: $25,00')).toBeVisible();
});

test('does not warn when there is no overpayment', async () => {
	const screen = await render(PaymentRailSection, props());

	expect(screen.container.textContent).not.toContain('El monto supera la deuda.');
});
