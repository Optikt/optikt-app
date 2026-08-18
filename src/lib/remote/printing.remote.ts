/**
 * Impresión del recibo de venta en la TICKERA (agente local optikt-print-agent).
 *
 * Este camino es DISTINTO e independiente del recibo A4/PDF que ya existe:
 * hace POST al agente con datos estructurados; el agente formatea a ESC/POS
 * de 80mm y lo manda al Spooler de Windows (Kadosh).
 *
 * Contract v2 (convenido con el agente): TODO en bolívares, convirtiendo por la
 * tasa USD-BCV más reciente ya cachead en la app. El recibo lleva date/time.
 *
 * Si la PC de recepción está apagada o el agente no responde, devolvemos un
 * error amigable — no hay cola aún (fase 1 síncrona).
 */
import { command } from '$app/server';
import { env } from '$env/dynamic/private';
import { requireRole } from '$lib/server/guards';
import { UserRole, SaleStatus } from '$lib/shared/enums';
import {
	getPaymentMethodLabel,
	isBsPaymentMethod,
	type PaymentMethod
} from '$lib/shared/enums/paymentMethods';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { fromISO } from '$lib/dates';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments,
	type SaleItemWithDetails
} from '$lib/server/db/queries/sales';
import { getSettings } from '$lib/server/db/queries/settings';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { computeSnapshotTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
import { computeDiscount } from '$lib/utils';
import { getPrintItemLabel, getPrintLensRxSummary } from '$lib/utils/printDocumentItems';
import { PrintTickeraSchema } from '$lib/schemas/printing';

const AGENT_TIMEOUT_MS = 10_000;
const BCV_CODE = 'USD'; // tasa usada para convertir todo el recibo a Bs

type TickeraItem = {
	description: string;
	quantity: number;
	unitPrice: number; // Bs
	price: number; // Bs
};

type TickeraPayment = {
	method: string;
	amount: number; // Bs
};

type TickeraPayload = {
	type: 'SALE';
	store: {
		name: string | null;
		rif: string | null;
		address: string | null;
	};
	receiptNumber: number;
	date: string; // dd/mm/yy
	time: string; // HH:mm
	customer: string;
	customerIdNumber: string | null;
	items: TickeraItem[];
	totals: {
		currency: 'Bs';
		subtotal: number;
		discount: number;
		taxRate: number | null;
		tax: number;
		total: number;
	};
	payments: TickeraPayment[];
	footerMessage: string | null;
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

function toBs(usd: number, rate: number): number {
	return Math.round(usd * rate * 100) / 100;
}

function formatReceiptDateTime(saleDate: string): { date: string; time: string } {
	const d = fromISO(saleDate);
	const date = new Intl.DateTimeFormat('es-VE', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit'
	}).format(d);
	const time = new Intl.DateTimeFormat('es-VE', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(d);
	return { date, time };
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

	const items: TickeraItem[] = rows.map((item) => {
		const gross = item.unitPrice * item.quantity;
		const lineTotal = gross - computeDiscount(item.discount, item.discountType, gross);
		return {
			description: describeItem(item),
			quantity: item.quantity,
			unitPrice: toBs(item.unitPrice, bcvRate),
			price: toBs(lineTotal, bcvRate)
		};
	});

	const taxBreakdown = computeSnapshotTaxBreakdown(saleItems, sale.snapshotTaxRate);
	const subtotal = taxBreakdown.taxableBase + taxBreakdown.exemptTotal;
	const taxRate = sale.snapshotTaxRate && sale.snapshotTaxRate > 0 ? sale.snapshotTaxRate : null;

	const tickeraPayments: TickeraPayment[] = payments.map((payment) => {
		const isBs = isBsPaymentMethod(payment.paymentMethod as PaymentMethod);
		const amountBs = isBs ? payment.amount : toBs(payment.amountBcvUsd ?? payment.amount, bcvRate);
		return { method: getPaymentMethodLabel(payment.paymentMethod), amount: amountBs };
	});

	const { date, time } = formatReceiptDateTime(sale.saleDate);

	const payload: TickeraPayload = {
		type: 'SALE',
		store: {
			name: settings.businessName?.trim() || null,
			rif: settings.businessRif?.trim() || null,
			address: settings.businessAddress?.trim() || null
		},
		receiptNumber: sale.orderNumber,
		date,
		time,
		customer: sale.customer
			? `${sale.customer.firstName} ${sale.customer.lastName}`
			: 'Cliente General',
		customerIdNumber: sale.customer?.idNumber ?? null,
		items,
		totals: {
			currency: 'Bs',
			subtotal: toBs(subtotal, bcvRate),
			discount: sale.discount > 0 ? toBs(sale.discount, bcvRate) : 0,
			taxRate,
			tax: toBs(taxBreakdown.taxAmount, bcvRate),
			total: toBs(sale.total, bcvRate)
		},
		payments: tickeraPayments,
		footerMessage: '¡Gracias por su compra!'
	};

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
