<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { nowUTC, toISODate } from '$lib/dates';
	import {
		ConfirmModal,
		PaymentMethodPills,
		PaymentRateInput,
		PaymentReferenceField
	} from '$lib/components/ui';
	import { addPayment } from '$lib/remote/sales.remote';
	import { addPurchaseOrderPaymentCmd } from '$lib/remote/purchaseOrders.remote';
	import {
		CurrencyCode,
		PAYMENT_CURRENCY_GROUPS,
		PAYMENT_METHOD_ICONS,
		PAYMENT_METHOD_LABELS,
		PAYMENT_RAILS_BY_CURRENCY,
		SALES_RAILS_BY_CURRENCY,
		PaymentMethod,
		currencyForPurchasePaymentMethod,
		getExchangeRateLabel,
		getPaymentMethodCurrency,
		isBsPaymentMethod,
		rateTypeForCurrency,
		rateTypeForRail
	} from '$lib/shared/enums';
	import { getSettlementCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
	import {
		computePaymentExchangeVariance,
		denormalizePurchasePaymentAmount,
		normalizePurchasePaymentAmounts
	} from '$lib/shared/purchaseOrderPayments';
	import { getEarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
	import type {
		EarlyPaymentDiscountSuggestion,
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import type { PurchaseOrder, PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
	import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { formatCurrency, formatDateOnly, formatPrice, getErrorMessage } from '$lib/utils';
	import {
		calculatePaymentAmountFromUsdBcv,
		calculateUsdBcvFromPaymentAmount,
		getDefaultPaymentCalculationMode,
		roundCurrency
	} from './paymentFormCalculations';

	export interface PaymentComposerRequest {
		token: string;
		amount?: number;
		paymentDate?: string;
		reference?: string;
		notes?: string;
		paymentMethod?: PaymentMethod;
	}

	interface ReferenceConfig {
		label: string;
		required: boolean;
		placeholder: string;
		helper?: string;
		fallbackValue?: string;
	}

	interface Props {
		kind: 'sale' | 'purchase';
		// --- sale ---
		saleId?: string;
		remainingBcvUsd?: number;
		onPaymentAdded?: (paidAmount: number) => void;
		// --- purchase ---
		purchaseOrderId?: string;
		status?: string;
		defaultBcvRate?: number;
		purchaseOrder?: PurchaseOrder;
		payments?: PurchaseOrderPaymentWithUsers[];
		earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
		pendingBalanceUsd?: number;
		debtTotalUsd?: number;
		isFullyPaid?: boolean;
		settlementCurrency?: string;
		composerRequest?: PaymentComposerRequest | null;
		onFinanceChanged?: (payload: {
			payments: PurchaseOrderPaymentWithUsers[];
			earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
		// --- shared ---
		bcvRate?: number;
		drawerResetKey?: number;
		variant?: 'default' | 'drawer';
	}

	let {
		kind,
		saleId,
		remainingBcvUsd = 0,
		onPaymentAdded,
		purchaseOrderId,
		status,
		defaultBcvRate = 0,
		purchaseOrder,
		payments = [],
		earlyPaymentBenefits = [],
		pendingBalanceUsd,
		debtTotalUsd,
		isFullyPaid = false,
		settlementCurrency,
		composerRequest = null,
		onFinanceChanged,
		bcvRate = 0,
		drawerResetKey = 0,
		variant = 'default'
	}: Props = $props();

	const store = getExchangeRatesStore();
	const storeBcvRate = $derived(store.bcvRate);
	const eurRate = $derived(store.rates.find((r) => r.code === 'EUR')?.value ?? 0);
	const usdtRate = $derived(store.rates.find((r) => r.sourceKey === 'usdt')?.value ?? 0);
	const paypalRate = $derived(store.rates.find((r) => r.code === 'PAYPAL')?.value ?? 0);
	const effectiveBcvRate = $derived(
		(kind === 'purchase' ? defaultBcvRate : bcvRate) > 0
			? kind === 'purchase'
				? defaultBcvRate
				: bcvRate
			: storeBcvRate
	);
	const defaultBcvRateInput = $derived(effectiveBcvRate > 0 ? effectiveBcvRate.toFixed(2) : '');

	let currencyKey = $state<string | null>(null);
	let rail = $state<PaymentMethod | null>(null);
	let lastEditedAmount = $state<'native' | 'usd'>('native');
	let nativeAmountInput = $state('');
	let usdBcvAmountInput = $state('');
	let bcvRateInput = $state('');
	let specificRateInput = $state('');
	let paymentDate = $state(toISODate(nowUTC()));
	let reference = $state('');
	let notes = $state('');
	let submitting = $state(false);
	let amountInputEl = $state<HTMLInputElement | null>(null);
	let isCashea = $state(false);
	let showOverpaymentModal = $state(false);
	let pendingAddPayload = $state<Parameters<typeof addPurchaseOrderPaymentCmd>[0] | null>(null);
	let showEarlyPaymentBenefitModal = $state(false);
	let pendingBenefitSuggestion = $state<EarlyPaymentDiscountSuggestion | null>(null);
	let benefitAmountInput = $state('');
	let benefitNoteInput = $state('');

	const canManagePurchasePayments = $derived(
		kind === 'purchase' && status === 'CONFIRMED' && !isFullyPaid
	);
	const isNativeSettlement = $derived(
		kind === 'purchase' && settlementCurrency != null && settlementCurrency !== CurrencyCode.USD_BCV
	);
	const settlementSymbol = $derived(
		isNativeSettlement ? getSettlementCurrencySymbol(settlementCurrency!) : ''
	);
	const railsByCurrency = $derived(
		kind === 'purchase' ? PAYMENT_RAILS_BY_CURRENCY : SALES_RAILS_BY_CURRENCY
	);
	const selectedCurrency = $derived(
		PAYMENT_CURRENCY_GROUPS.find((g) => g.key === currencyKey) ?? null
	);
	const rateType = $derived.by(() => {
		if (rail && !isBsPaymentMethod(rail)) return rateTypeForRail(rail);
		return currencyKey ? rateTypeForCurrency(currencyKey) : null;
	});
	const purchaseCurrencyCode = $derived(rail ? getPaymentMethodCurrency(rail) : CurrencyCode.OTHER);
	const needsSpecificRate = $derived.by(() => {
		if (!rail || !currencyKey) return false;
		if (!isBsPaymentMethod(rail)) return true;
		return (
			currencyKey === 'EUR_BCV' ||
			currencyKey === 'USDT' ||
			currencyKey === 'PAYPAL' ||
			currencyKey === 'OTHER'
		);
	});
	const specificRateLabel = $derived.by(() => {
		if (rail && !isBsPaymentMethod(rail)) {
			const l = getExchangeRateLabel(rail);
			if (l) return l;
		}
		return selectedCurrency?.rateLabel ?? 'Tasa usada (Bs/unidad)';
	});
	const autoSpecificRate = $derived.by(() => {
		if (rail === PaymentMethod.EFECTIVO_USD || rail === PaymentMethod.EFECTIVO_EUR) return 0;
		switch (currencyKey) {
			case 'EUR_BCV':
				return eurRate;
			case 'USDT':
				return usdtRate;
			case 'PAYPAL':
				return paypalRate;
			default:
				return 0;
		}
	});

	function inputToNumber(value: string): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	function formatInputValue(value: number): string {
		return value > 0 ? value.toFixed(2) : '';
	}

	const activeBcvRate = $derived(inputToNumber(bcvRateInput || defaultBcvRateInput));
	const specificRateValue = $derived(inputToNumber(specificRateInput));
	const typedNativeAmount = $derived(inputToNumber(nativeAmountInput));
	const typedUsdBcvAmount = $derived(inputToNumber(usdBcvAmountInput));

	// ----- Amount conversions (kind-specific) -----
	const saleForwardUsd = $derived.by(() => {
		if (kind !== 'sale' || !rail) return 0;
		return calculateUsdBcvFromPaymentAmount({
			method: rail,
			paymentAmount: typedNativeAmount,
			bcvRate: activeBcvRate,
			exchangeRate: specificRateValue
		});
	});
	const saleReverseNative = $derived.by(() => {
		if (kind !== 'sale' || !rail) return 0;
		return calculatePaymentAmountFromUsdBcv({
			method: rail,
			usdBcvAmount: typedUsdBcvAmount,
			bcvRate: activeBcvRate,
			exchangeRate: specificRateValue
		});
	});
	const purchaseNormalized = $derived(
		normalizePurchasePaymentAmounts({
			currencyCode: purchaseCurrencyCode,
			amount: typedNativeAmount,
			bcvUsdRate: activeBcvRate,
			specificRate: needsSpecificRate ? specificRateValue : undefined
		})
	);
	const purchaseReverseNative = $derived(
		denormalizePurchasePaymentAmount({
			currencyCode: purchaseCurrencyCode,
			amountUsdBcv: typedUsdBcvAmount,
			bcvUsdRate: activeBcvRate,
			specificRate: needsSpecificRate ? specificRateValue : undefined
		})
	);

	const forwardUsd = $derived(kind === 'sale' ? saleForwardUsd : purchaseNormalized.amountUsdBcv);
	const reverseNative = $derived(kind === 'sale' ? saleReverseNative : purchaseReverseNative);
	const resolvedAmountUsd = $derived(lastEditedAmount === 'usd' ? typedUsdBcvAmount : forwardUsd);
	const resolvedNativeAmount = $derived(
		lastEditedAmount === 'native' ? typedNativeAmount : reverseNative
	);
	const usdFieldValue = $derived(
		lastEditedAmount === 'usd' ? usdBcvAmountInput : formatInputValue(forwardUsd)
	);
	const nativeFieldValue = $derived(
		lastEditedAmount === 'native' ? nativeAmountInput : formatInputValue(reverseNative)
	);

	// ----- Settlement (purchase) -----
	const amountAppliedToDebt = $derived.by(() => {
		if (!isNativeSettlement) return undefined;
		if (purchaseCurrencyCode === CurrencyCode.VES && specificRateValue > 0) {
			return Math.round((resolvedNativeAmount / specificRateValue) * 100) / 100;
		}
		if (purchaseCurrencyCode === settlementCurrency) return resolvedNativeAmount;
		return undefined;
	});
	const exchangeVariance = $derived(
		isNativeSettlement && (amountAppliedToDebt ?? 0) > 0
			? computePaymentExchangeVariance(
					amountAppliedToDebt ?? 0,
					debtTotalUsd ?? 0,
					(debtTotalUsd ?? 0) > 0 ? (debtTotalUsd ?? 0) : (amountAppliedToDebt ?? 0),
					resolvedAmountUsd
				)
			: 0
	);

	// ----- Remaining / overpayment -----
	const debtBalanceUsd = $derived(kind === 'sale' ? remainingBcvUsd : (pendingBalanceUsd ?? 0));

	const overpaymentAmount = $derived(Math.max(0, resolvedAmountUsd - debtBalanceUsd));
	const restLabelClass = $derived.by(() => {
		if (overpaymentAmount > 0.01) return 'text-error';
		if (pendingAfterPayment > 0.01) return 'text-warning';
		return 'text-success';
	});

	// ----- Early payment suggestion (purchase) -----
	const hasActiveEarlyPaymentBenefit = $derived(
		earlyPaymentBenefits.some((benefit) => !benefit.voidedAt)
	);
	const liveEarlyPaymentSuggestion = $derived(
		kind === 'purchase' &&
			!hasActiveEarlyPaymentBenefit &&
			pendingBalanceUsd != null &&
			debtTotalUsd != null &&
			purchaseOrder
			? getEarlyPaymentDiscountSuggestion({
					terms: purchaseOrder,
					totalDebt: debtTotalUsd,
					currentBalance: pendingBalanceUsd,
					paymentAmount: resolvedAmountUsd,
					paymentDate
				})
			: null
	);
	const showPurchasePreview = $derived(
		purchaseNormalized.amountBs > 0 ||
			resolvedAmountUsd > 0 ||
			(isNativeSettlement && (amountAppliedToDebt ?? 0) > 0) ||
			!!liveEarlyPaymentSuggestion
	);

	const resolvedUsdDisplay = $derived(formatPrice(resolvedAmountUsd));
	const overpaymentDisplay = $derived(formatPrice(overpaymentAmount));
	const pendingAfterPayment = $derived(Math.max(0, debtBalanceUsd - resolvedAmountUsd));

	// ----- Reference config -----
	const referenceConfig = $derived.by((): ReferenceConfig => {
		switch (rail) {
			case PaymentMethod.PAGO_MOVIL_BS:
				return {
					label: 'Número de confirmación',
					required: true,
					placeholder: 'Secuencia o referencia del pago móvil',
					helper: 'Obligatorio.'
				};
			case PaymentMethod.TRANSFERENCIA_BS:
				return {
					label: 'Número de transacción',
					required: true,
					placeholder: 'Referencia bancaria',
					helper: 'Obligatorio.'
				};
			case PaymentMethod.PUNTO_VENTA_BS:
				return {
					label: 'Número de lote / batch',
					required: false,
					placeholder: 'Opcional',
					helper: 'Si no aplica, se guardará --',
					fallbackValue: '--'
				};
			case PaymentMethod.BINANCE_USDT:
				return {
					label: 'ID de transacción',
					required: true,
					placeholder: 'ID o confirmación Binance',
					helper: 'Obligatorio.'
				};
			case PaymentMethod.EFECTIVO_BS:
			case PaymentMethod.EFECTIVO_USD:
			case PaymentMethod.EFECTIVO_EUR:
			case PaymentMethod.PAYPAL:
				return {
					label: 'Referencia',
					required: false,
					placeholder: '--',
					helper: 'Opcional.'
				};
			default:
				return {
					label: 'Referencia',
					required: false,
					placeholder: '',
					helper: ''
				};
		}
	});
	const referenceToSubmit = $derived.by(() => {
		const trimmed = reference.trim();
		if (trimmed) return trimmed;
		return referenceConfig.fallbackValue;
	});
	const hasRequiredReference = $derived(!referenceConfig.required || reference.trim().length > 0);

	// ----- Native display -----
	const nativeLabel = $derived.by(() => {
		switch (rail) {
			case PaymentMethod.BINANCE_USDT:
				return 'Monto (USDT)';
			case PaymentMethod.EFECTIVO_USD:
				return 'Monto (Efectivo $)';
			case PaymentMethod.EFECTIVO_EUR:
				return 'Monto (Efectivo €)';
			case PaymentMethod.PAYPAL:
				return 'Monto (PayPal $)';
			default:
				return 'Monto (Bs)';
		}
	});
	const nativePrefix = $derived.by(() => {
		switch (rail) {
			case PaymentMethod.BINANCE_USDT:
				return 'USDT';
			case PaymentMethod.EFECTIVO_EUR:
				return '€';
			case PaymentMethod.EFECTIVO_USD:
			case PaymentMethod.PAYPAL:
				return '$';
			default:
				return 'Bs';
		}
	});
	const rateContextLine = $derived.by(() => {
		if (resolvedAmountUsd <= 0 || activeBcvRate <= 0) return '';
		if (kind === 'purchase' && purchaseCurrencyCode === CurrencyCode.VES) {
			return `${activeBcvRate.toFixed(2)} × ${formatPrice(resolvedAmountUsd)}`;
		}
		if (kind === 'sale' && rail && isBsPaymentMethod(rail)) {
			return `${activeBcvRate.toFixed(2)} × ${formatPrice(resolvedAmountUsd)}`;
		}
		if (specificRateValue <= 0) return '';
		return `${formatPrice(resolvedAmountUsd)} × ${activeBcvRate.toFixed(2)} ÷ ${specificRateValue.toFixed(2)}`;
	});

	// ----- Reset -----
	function reset() {
		currencyKey = null;
		rail = null;
		lastEditedAmount = 'native';
		nativeAmountInput = '';
		usdBcvAmountInput = '';
		bcvRateInput = '';
		specificRateInput = '';
		paymentDate = toISODate(nowUTC());
		reference = '';
		notes = '';
		isCashea = false;
	}

	function partialReset() {
		nativeAmountInput = '';
		usdBcvAmountInput = '';
		bcvRateInput = '';
		specificRateInput = '';
		reference = '';
		notes = '';
	}

	function resetForm(request: PaymentComposerRequest | null = null) {
		rail = request?.paymentMethod ?? null;
		currencyKey = rail
			? currencyForPurchasePaymentMethod(rail) === CurrencyCode.EUR_BCV
				? 'EUR_BCV'
				: currencyForPurchasePaymentMethod(rail) === CurrencyCode.USDT
					? 'USDT'
					: currencyForPurchasePaymentMethod(rail) === CurrencyCode.USD_PAYPAL
						? 'PAYPAL'
						: 'VES'
			: null;
		paymentDate = request?.paymentDate ?? toISODate(nowUTC());
		nativeAmountInput = request?.amount != null ? request.amount.toFixed(2) : '';
		usdBcvAmountInput = '';
		lastEditedAmount = 'native';
		bcvRateInput = '';
		specificRateInput = '';
		reference = request?.reference ?? '';
		notes = request?.notes ?? '';
		isCashea = false;
	}

	let prevDrawerResetKey = 0;
	$effect(() => {
		const key = drawerResetKey;
		if (key !== prevDrawerResetKey) {
			prevDrawerResetKey = key;
			reset();
		}
	});

	let lastComposerToken = '';
	$effect(() => {
		if (kind !== 'purchase' || !composerRequest || !canManagePurchasePayments) return;
		if (composerRequest.token === lastComposerToken) return;
		untrack(() => {
			lastComposerToken = composerRequest.token;
			resetForm(composerRequest);
		});
	});

	// Pre-select settlement rate context for native settlements (purchase)
	$effect(() => {
		if (kind !== 'purchase' || !isNativeSettlement || currencyKey) return;
		const map: Record<string, string> = {
			EUR_BCV: 'EUR_BCV',
			USDT: 'USDT',
			USD_PAYPAL: 'PAYPAL'
		};
		const key = map[settlementCurrency!];
		if (!key) return;
		currencyKey = key;
		rail = PaymentMethod.TRANSFERENCIA_BS;
		const orderRate = purchaseOrder?.sourceRateToVes;
		if (orderRate != null && orderRate > 0) specificRateInput = String(orderRate);
	});

	// Focus amount input on drawer open (drawer variant)
	$effect(() => {
		if (variant !== 'drawer') return;
		if (rail && amountInputEl) amountInputEl.focus();
	});

	// ----- Selection handlers -----
	function selectCurrency(key: string) {
		if (currencyKey === key) return;
		currencyKey = key;
		rail = null;
		lastEditedAmount = 'native';
		nativeAmountInput = '';
		usdBcvAmountInput = '';
		specificRateInput = '';
	}

	function selectRail(method: PaymentMethod) {
		rail = method;
		lastEditedAmount = getDefaultPaymentCalculationMode(method) === 'target' ? 'usd' : 'native';
		nativeAmountInput = '';
		usdBcvAmountInput = '';
		bcvRateInput = '';
		const auto = autoSpecificRate;
		specificRateInput = auto > 0 ? auto.toFixed(2) : '';
		reference = '';
		notes = '';
		isCashea = false;
	}

	function handleNativeInput(event: Event) {
		lastEditedAmount = 'native';
		nativeAmountInput = (event.currentTarget as HTMLInputElement).value;
	}

	function handleUsdInput(event: Event) {
		lastEditedAmount = 'usd';
		usdBcvAmountInput = (event.currentTarget as HTMLInputElement).value;
	}

	function useRemainingBalance() {
		if (kind !== 'sale' || !rail) return;
		lastEditedAmount = 'usd';
		usdBcvAmountInput = formatInputValue(debtBalanceUsd);
	}

	// ----- Submit -----
	async function submitSalePayment() {
		if (!saleId || !rail) return;
		submitting = true;
		try {
			const result = await addPayment({
				saleId,
				paymentMethod: rail,
				paymentDate,
				amount: roundCurrency(resolvedNativeAmount),
				usdBcvAmount: resolvedAmountUsd,
				exchangeRate: needsSpecificRate ? specificRateValue : undefined,
				bcvRate: activeBcvRate,
				rateType: rateType ?? undefined,
				isCasheaPayment: isCashea || undefined,
				reference: referenceToSubmit,
				notes: notes.trim() || undefined
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error registrando pago');
				return;
			}

			const remainingAfterSave = Math.max(0, remainingBcvUsd - resolvedAmountUsd);
			toast.success(
				remainingAfterSave <= 0.01
					? 'Pago registrado. La venta quedó cubierta.'
					: `Pago registrado. Quedan ${formatPrice(remainingAfterSave)} pendientes.`
			);

			if (pendingAfterPayment <= 0.01) reset();
			else partialReset();
			onPaymentAdded?.(result.paidAmount);
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error registrando pago'));
		} finally {
			submitting = false;
		}
	}

	async function submitPurchasePayment(payload: Parameters<typeof addPurchaseOrderPaymentCmd>[0]) {
		if (!purchaseOrderId || !rail) return;
		submitting = true;
		try {
			const result = await addPurchaseOrderPaymentCmd(payload);
			if (!result.success) {
				toast.error(result.error ?? 'Error registrando pago');
				return;
			}
			onFinanceChanged?.({
				payments: result.payments,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
			toast.success('Pago registrado');
			partialReset();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error registrando pago'));
		} finally {
			submitting = false;
		}
	}

	function buildPurchasePayload(): Parameters<typeof addPurchaseOrderPaymentCmd>[0] | null {
		if (!purchaseOrderId || !rail) return null;
		return {
			purchaseOrderId,
			paymentMethod: rail,
			paymentDate,
			amount: resolvedNativeAmount,
			bcvUsdRate: activeBcvRate,
			specificRate: needsSpecificRate ? specificRateValue : undefined,
			amountAppliedToDebt: amountAppliedToDebt ?? undefined,
			rateType: rateType ?? undefined,
			reference: referenceToSubmit,
			notes: notes.trim() || undefined
		};
	}

	async function maybeSubmitPurchase() {
		const payload = buildPurchasePayload();
		if (!payload) return;

		if (pendingBalanceUsd != null && resolvedAmountUsd > pendingBalanceUsd + 0.01) {
			pendingAddPayload = payload;
			showOverpaymentModal = true;
			return;
		}
		if (liveEarlyPaymentSuggestion) {
			pendingAddPayload = payload;
			pendingBenefitSuggestion = liveEarlyPaymentSuggestion;
			benefitAmountInput = liveEarlyPaymentSuggestion.amount.toFixed(2);
			benefitNoteInput = '';
			showEarlyPaymentBenefitModal = true;
			return;
		}
		await submitPurchasePayment(payload);
	}

	async function submitPaymentWithBenefit(appliedToBalance: boolean) {
		if (!pendingAddPayload || !pendingBenefitSuggestion) return;
		const amountUsdBcv = Number(benefitAmountInput || 0);
		if (!Number.isFinite(amountUsdBcv) || amountUsdBcv <= 0) {
			toast.error('Monto de beneficio inválido');
			return;
		}
		if (amountUsdBcv > pendingBenefitSuggestion.amount + 0.01) {
			toast.error(`El beneficio no debe superar ${formatPrice(pendingBenefitSuggestion.amount)}`);
			return;
		}
		if (appliedToBalance && amountUsdBcv >= pendingBenefitSuggestion.currentBalance - 0.01) {
			toast.error('El beneficio aplicado no puede igualar o superar el saldo pendiente');
			return;
		}

		let payload: Parameters<typeof addPurchaseOrderPaymentCmd>[0] = {
			...pendingAddPayload,
			earlyPaymentBenefit: {
				amountUsdBcv,
				amountAppliedToDebt: isNativeSettlement ? amountUsdBcv : undefined,
				amountAppliedToDebtUsdBcvAtOrder: isNativeSettlement ? amountUsdBcv : undefined,
				appliedToBalance,
				note: benefitNoteInput || undefined
			}
		};

		if (appliedToBalance) {
			const adjustedPaymentUsdBcv = Math.max(
				pendingBenefitSuggestion.currentBalance - amountUsdBcv,
				0
			);
			const adjustedAmount = denormalizePurchasePaymentAmount({
				currencyCode: purchaseCurrencyCode,
				amountUsdBcv: adjustedPaymentUsdBcv,
				bcvUsdRate: activeBcvRate,
				specificRate: needsSpecificRate ? specificRateValue : undefined
			});
			if (!Number.isFinite(adjustedAmount) || adjustedAmount <= 0) {
				toast.error('No se pudo ajustar el monto del pago con el pronto pago');
				return;
			}
			payload = { ...payload, amount: adjustedAmount };
		}

		pendingAddPayload = null;
		resetEarlyPaymentState();
		await submitPurchasePayment(payload);
	}

	function resetEarlyPaymentState() {
		showEarlyPaymentBenefitModal = false;
		pendingBenefitSuggestion = null;
		benefitAmountInput = '';
		benefitNoteInput = '';
	}

	function handleSubmit() {
		if (kind === 'sale') {
			void submitSalePayment();
		} else {
			void maybeSubmitPurchase();
		}
	}

	const hasValidAmounts = $derived(resolvedAmountUsd > 0 && resolvedNativeAmount > 0);
	const hasValidRate = $derived(activeBcvRate > 0 && (!needsSpecificRate || specificRateValue > 0));
	const canSubmit = $derived(
		!!rail &&
			!!currencyKey &&
			hasValidAmounts &&
			hasValidRate &&
			!!paymentDate &&
			hasRequiredReference &&
			!submitting
	);
	const drawerSubmitLabel = $derived(
		kind === 'sale' && pendingAfterPayment <= 0.01 ? 'Finalizar Venta' : 'Aplicar Pago'
	);
	const submitLabel = $derived(
		hasValidAmounts ? `Registrar abono de ${formatPrice(resolvedAmountUsd)}` : 'Registrar pago'
	);
</script>

<div class="space-y-4">
	<!-- Paso 1: moneda / tasa -->
	<div>
		<p class="mb-2.5 text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
			Moneda / tasa
		</p>
		<PaymentMethodPills
			methods={PAYMENT_CURRENCY_GROUPS.map((g) => g.key)}
			labels={Object.fromEntries(PAYMENT_CURRENCY_GROUPS.map((g) => [g.key, g.label]))}
			selected={currencyKey}
			onSelect={(key) => selectCurrency(key as string)}
		/>
	</div>

	<!-- Paso 2: riel -->
	{#if currencyKey}
		<div>
			<p class="mb-2.5 text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
				Método
			</p>
			<PaymentMethodPills
				methods={railsByCurrency[currencyKey]}
				labels={PAYMENT_METHOD_LABELS}
				selected={rail}
				onSelect={(m) => selectRail(m as PaymentMethod)}
				icons={PAYMENT_METHOD_ICONS}
			/>
		</div>
	{/if}

	{#if rail}
		<div class="space-y-3">
			<!-- Fecha -->
			<div>
				<label
					for="pay-date"
					class="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
				>
					Fecha
				</label>
				<input
					id="pay-date"
					type="date"
					bind:value={paymentDate}
					max="9999-12-31"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-on-surface focus:border-brand-blue focus:outline-none"
				/>
			</div>

			<!-- Amounts 2 cols -->
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="space-y-1.5">
					<div class="flex items-center justify-between gap-2">
						<label
							for="pay-usd"
							class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
						>
							USD BCV
						</label>
						{#if kind === 'sale'}
							<button
								type="button"
								onclick={useRemainingBalance}
								class="shrink-0 text-[10px] font-semibold text-warning transition-colors hover:text-warning"
							>
								Usar saldo
							</button>
						{/if}
					</div>
					<div class="relative">
						<span
							class="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-base text-outline"
							>$</span
						>
						<input
							id="pay-usd"
							type="number"
							value={usdFieldValue}
							oninput={handleUsdInput}
							placeholder={debtBalanceUsd > 0 ? debtBalanceUsd.toFixed(2) : '0.00'}
							step="0.01"
							min="0"
							class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-2.5 pr-3.5 pl-8 font-mono text-sm font-semibold text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none transition-all duration-200"
						/>
					</div>
				</div>

				<div class="space-y-1.5 flex flex-col">
					<label
						for="pay-native"
						class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
					>
						{nativeLabel}
					</label>
					<div class="relative">
						<span
							class="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm font-semibold text-outline"
							>{nativePrefix}</span
						>
						<input
							id="pay-native"
							type="number"
							value={nativeFieldValue}
							oninput={handleNativeInput}
							placeholder="0.00"
							step="0.01"
							min="0"
							bind:this={amountInputEl}
							class="w-full rounded-xl border border-brand-navy/20 bg-surface-container-low py-2.5 pr-3.5 pl-16 font-mono text-sm font-semibold text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none transition-all duration-200 ring-1 ring-brand-navy/10"
						/>
					</div>
				</div>
			</div>

			{#if resolvedAmountUsd > 0}
				<p class="text-xs text-on-surface-variant tabular-nums">
					≈ {resolvedUsdDisplay} USD BCV{#if rateContextLine}
						<span class="text-on-surface-variant/70"> · {rateContextLine}</span>
					{/if}
				</p>
			{/if}

			<!-- Rates 2 cols -->
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<PaymentRateInput
					label="Tasa BCV"
					value={bcvRateInput}
					oninput={(value) => (bcvRateInput = value)}
					placeholder={defaultBcvRateInput || '0.00'}
					class={needsSpecificRate ? '' : 'sm:col-span-2'}
				/>
				{#if needsSpecificRate}
					<PaymentRateInput
						label={specificRateLabel}
						value={specificRateInput}
						oninput={(value) => (specificRateInput = value)}
						placeholder={autoSpecificRate > 0 ? autoSpecificRate.toFixed(2) : '0.00'}
					/>
				{/if}
			</div>

			<!-- Cashea (sale, Bs rails) -->
			{#if kind === 'sale' && isBsPaymentMethod(rail)}
				<label class="flex items-center gap-2 text-xs text-on-surface-variant">
					<input
						type="checkbox"
						bind:checked={isCashea}
						class="h-4 w-4 rounded border-outline-variant/40 bg-surface-container-lowest accent-brand-blue"
					/>
					<span class="font-medium text-on-surface">Pago vía Cashea</span>
					<span class="text-on-surface-variant">— venta financiada por Cashea</span>
				</label>
			{/if}

			<!-- Referencia + notas -->
			<PaymentReferenceField
				{reference}
				{notes}
				label={referenceConfig.label}
				placeholder={referenceConfig.placeholder}
				required={referenceConfig.required}
				helper={referenceConfig.helper}
				onReference={(value) => (reference = value)}
				onNotes={(value) => (notes = value)}
			/>

			<!-- Sale: overpayment warning -->
			{#if kind === 'sale' && overpaymentAmount > 0.01}
				<div class="rounded-lg bg-error-container/50 px-3 py-2 text-xs text-on-error-container">
					<p class="font-semibold">El monto supera la deuda.</p>
					<p>Excedente: {overpaymentDisplay}</p>
				</div>
			{/if}

			<!-- Preview -->
			{#if kind === 'sale'}
				<div
					class="flex items-center justify-between rounded-lg bg-surface-container-high/70 px-3 py-2"
				>
					<div>
						<p class="text-[10px] text-on-surface-variant">Restará luego</p>
						<p class="font-mono text-sm font-bold tabular-nums {restLabelClass}">
							{formatPrice(pendingAfterPayment)}
						</p>
					</div>
					<div class="text-right">
						<p class="text-[10px] text-on-surface-variant">Método</p>
						<p class="text-xs font-semibold text-on-surface">
							{PAYMENT_METHOD_LABELS[rail as PaymentMethod]}
						</p>
					</div>
				</div>
			{:else if showPurchasePreview}
				<div
					class="rounded-lg bg-surface-container-high px-3 py-2.5 text-xs font-mono {isNativeSettlement &&
					amountAppliedToDebt != null &&
					amountAppliedToDebt > 0
						? 'space-y-1'
						: ''}"
				>
					<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
						{#if purchaseNormalized.amountBs > 0}
							<span class="text-on-surface-variant"
								>Bs {formatCurrency(purchaseNormalized.amountBs)}</span
							>
						{/if}
						{#if resolvedAmountUsd > 0}
							<span class="text-outline">·</span>
							<span class="font-semibold text-brand-navy">{resolvedUsdDisplay}</span>
						{/if}
						{#if isNativeSettlement && amountAppliedToDebt != null && amountAppliedToDebt > 0}
							<span class="text-outline">·</span>
							<span class="text-on-surface-variant"
								>Abono {formatCurrency(amountAppliedToDebt)} {settlementSymbol}</span
							>
							<span
								class={exchangeVariance > 0
									? 'text-success'
									: exchangeVariance < 0
										? 'text-error'
										: 'text-on-surface-variant'}
							>
								· {exchangeVariance > 0 ? '+' : ''}{formatPrice(exchangeVariance)}
							</span>
						{/if}
					</div>
					{#if liveEarlyPaymentSuggestion}
						<div class="mt-1 flex items-center gap-1.5 text-[10px] text-brand-gold">
							<span class="font-semibold">Pronto pago</span>
							<span
								>· {formatDateOnly(liveEarlyPaymentSuggestion.deadline, {
									dateStyle: 'short'
								})} · {formatPrice(liveEarlyPaymentSuggestion.amount)}</span
							>
						</div>
					{/if}
				</div>
			{/if}

			<button
				type="button"
				onclick={handleSubmit}
				disabled={!canSubmit}
				class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-brand-navy/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
			>
				{variant === 'drawer' ? drawerSubmitLabel : submitLabel}
			</button>
		</div>
	{/if}
</div>

{#if kind === 'purchase'}
	<ConfirmModal
		bind:open={showOverpaymentModal}
		title="Pago supera el saldo"
		message={pendingAddPayload != null
			? `Este pago de ${resolvedUsdDisplay} supera el saldo pendiente de ${formatPrice(pendingBalanceUsd ?? 0)} en ${overpaymentDisplay}. ¿Registrar de todas formas?`
			: ''}
		confirmLabel="Registrar igual"
		confirmColor="yellow"
		loading={submitting}
		onConfirm={async () => {
			showOverpaymentModal = false;
			if (pendingAddPayload) await submitPurchasePayment(pendingAddPayload);
			pendingAddPayload = null;
		}}
		onCancel={() => {
			showOverpaymentModal = false;
			pendingAddPayload = null;
		}}
	/>

	<ConfirmModal
		bind:open={showEarlyPaymentBenefitModal}
		title="Pronto pago disponible"
		size="lg"
		confirmLabel="Aplicar a esta PO"
		secondaryLabel="Solo anotarlo"
		cancelLabel="No registrar todavía"
		confirmColor="green"
		secondaryColor="alternative"
		loading={submitting}
		onConfirm={() => void submitPaymentWithBenefit(true)}
		onSecondary={() => void submitPaymentWithBenefit(false)}
		onCancel={() => {
			showEarlyPaymentBenefitModal = false;
			pendingAddPayload = null;
			resetEarlyPaymentState();
		}}
		permanent
	>
		{#snippet body()}
			<div class="space-y-4 text-sm text-on-surface">
				<p>
					El pago califica para pronto pago de {pendingBenefitSuggestion?.percent ?? 0}% antes de {pendingBenefitSuggestion?.deadline ??
						'la fecha límite'}.
				</p>
				{#if pendingBenefitSuggestion}
					<p class="rounded-xl bg-info-container/40 px-3 py-2 text-xs text-on-surface-variant">
						Si lo aplicas al saldo, el pago se registrará por
						{formatPrice(pendingBenefitSuggestion.currentBalance - Number(benefitAmountInput || 0))}
						para completar esta orden sin sobrepagarla.
						{#if pendingBenefitSuggestion.overpayment > 0.01}
							El monto actual excede ese pago neto por
							{formatPrice(pendingBenefitSuggestion.overpayment)}.
						{/if}
					</p>
				{/if}
				<label class="block space-y-2">
					<span
						class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
					>
						Monto del beneficio USD
					</span>
					<input
						bind:value={benefitAmountInput}
						type="number"
						min="0"
						step="0.01"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
					/>
				</label>
				<label class="block space-y-2">
					<span
						class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
					>
						Nota opcional
					</span>
					<textarea
						bind:value={benefitNoteInput}
						rows="3"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
						placeholder="Ej. Proveedor aplicó redondeo o dejó crédito para próxima compra"
					></textarea>
				</label>
				<p class="rounded-xl bg-info-container/40 px-3 py-2 text-xs text-on-surface-variant">
					Aplicar a esta PO reduce el saldo y entra en reportes. Solo anotarlo guarda la decisión
					sin impacto financiero.
				</p>
			</div>
		{/snippet}
	</ConfirmModal>
{/if}
