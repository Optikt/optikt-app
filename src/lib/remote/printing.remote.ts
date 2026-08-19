/**
 * Impresión del recibo de venta en la TICKERA (agente local optikt-print-agent).
 *
 * Math + payload viven en $lib/shared/tickera.ts (puro, testeable). Acá solo:
 * guards, carga de datos (sale/items/payments/settings), tasa BCV, labels,
 * y el POST al agente (fase 1 síncrona, timeout, errores amigables).
 */
import { command } from '$app/server';
import { env } from '$env/dynamic/private';
import { requireRole } from '$lib/server/guards';
import { UserRole, SaleStatus } from '$lib/shared/enums';
import { PaymentMethod, isBsPaymentMethod } from '$lib/shared/enums/paymentMethods';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { buildTickeraPayload, type TickeraPayload } from '$lib/shared/tickera';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments,
	type SaleItemWithDetails
} from '$lib/server/db/queries/sales';
import { getSettings } from '$lib/server/db/queries/settings';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { getPrintItemLabel, getPrintLensRxSummary } from '$lib/utils/printDocumentItems';
import { PrintTickeraSchema } from '$lib/schemas/printing';

const AGENT_TIMEOUT_MS = 10_000;
const BCV_CODE = 'USD'; // tasa usada para convertir todo el recibo a Bs

/** Labels de método "listos para imprimir" (no toca PAYMENT_METHOD_LABELS de la UI). */
const TICKERA_PAYMENT_LABELS: Record<PaymentMethod, string> = {
	[PaymentMethod.PAGO_MOVIL_BS]: 'Pago Movil',
	[PaymentMethod.TRANSFERENCIA_BS]: 'Transferencia',
	[PaymentMethod.PUNTO_VENTA_BS]: 'Punto de Venta',
	[PaymentMethod.EFECTIVO_BS]: 'Efectivo',
	[PaymentMethod.EFECTIVO_USD]: 'Efectivo $',
	[PaymentMethod.EFECTIVO_EUR]: 'Efectivo €',
	[PaymentMethod.BINANCE_USDT]: 'Binance',
	[PaymentMethod.PAYPAL]: 'PayPal',
	[PaymentMethod.OTRO]: 'Zelle'
};

/** Mismo agrupado/orden de ítems que el recibo A4 (lentes con sus tratamientos). */
function buildItemsRows(items: SaleItemWithDetails[]): SaleItemWithDetails[] {
	const treatmentGroups = items.reduce<Record<string, SaleItemWithDetails[]>>((groups, item) => {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentSaleItemId) return groups;
		(groups[item.parentSaleItemId] ??= []).push(item);
		return groups;
	}, {});

	return items
		.filter((item) => item.itemType !== SaleItemType.TREATMENT)
		.flatMap((item) => [item, ...(treatmentGroups[item.id] ?? [])]);
}

function describeItem(item: SaleItemWithDetails): string {
	const label = getPrintItemLabel(item);
	if (item.itemType !== SaleItemType.LENS_PAIR) return label;
	return `${label} ${getPrintLensRxSummary(item)}`.trim();
}

export const printTickeraReceipt = command(PrintTickeraSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const agentUrl = env.PRINT_AGENT_URL?.trim();
	const agentToken = env.PRINT_AGENT_TOKEN?.trim();

	if (!agentUrl || !agentToken) {
		return {
			success: false as const,
			error:
				'Impresión por tickera no configurada en el servidor (PRINT_AGENT_URL / PRINT_AGENT_TOKEN)'
		};
	}

	const bcvRate = await getExchangeRateValue(BCV_CODE);
	if (bcvRate === null || bcvRate <= 0) {
		return {
			success: false as const,
			error: 'No hay tasa BCV disponible para convertir el recibo a bolívares'
		};
	}

	const sale = await findSaleByIdWithRelations(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}
	if (sale.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se puede imprimir una venta cancelada' };
	}

	const [saleItems, payments, settings] = await Promise.all([
		getSaleItemsWithDetails(data.saleId),
		getSalePayments(data.saleId),
		getSettings()
	]);

	const rows = buildItemsRows(saleItems);

	const payload: TickeraPayload = buildTickeraPayload({
		store: {
			name: settings.businessName?.trim() || null,
			rif: settings.businessRif?.trim() || null,
			address: settings.businessAddress?.trim() || null
		},
		orderNumber: sale.orderNumber,
		saleDate: sale.saleDate,
		customerName: sale.customer
			? `${sale.customer.firstName} ${sale.customer.lastName}`
			: 'Cliente General',
		customerIdNumber: sale.customer?.idNumber ?? null,
		snapshotTaxRate: sale.snapshotTaxRate,
		totalUsd: sale.total,
		isCashea: sale.isCashea,
		rows: rows.map((item) => ({
			description: describeItem(item),
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			discount: item.discount,
			discountType: item.discountType,
			snapshotIsTaxable: item.snapshotIsTaxable
		})),
		payments: payments.map((payment) => {
			const method = payment.paymentMethod as PaymentMethod;
			return {
				method: TICKERA_PAYMENT_LABELS[method] ?? 'Otro',
				amount: payment.amount,
				isBs: isBsPaymentMethod(method),
				amountBcvUsd: payment.amountBcvUsd
			};
		}),
		bcvRate,
		footerMessage: '¡Gracias por su compra!'
	});

	// Llamada síncrona al agente (fase 1). PC apagada → fetch rechaza → error amigable.
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

	try {
		const response = await fetch(`${agentUrl.replace(/\/$/, '')}/imprimir`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-auth-token': agentToken },
			body: JSON.stringify(payload),
			signal: controller.signal
		});

		const body = (await response.json().catch(() => ({}))) as { error?: string; bytes?: number };

		if (!response.ok) {
			return {
				success: false as const,
				error: body.error ?? `El agente de impresión respondió ${response.status}`
			};
		}

		return { success: true as const, bytes: body.bytes ?? null };
	} catch (error) {
		if ((error as Error).name === 'AbortError') {
			return {
				success: false as const,
				error: 'Tiempo de espera agotado. ¿Está encendida la PC de recepción?'
			};
		}
		return {
			success: false as const,
			error: `No se pudo conectar con el agente de impresión (${agentUrl}). ¿Está encendida la PC de recepción?`
		};
	} finally {
		clearTimeout(timeout);
	}
});
