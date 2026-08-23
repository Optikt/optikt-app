/**
 * Construcción del payload del recibo de venta para el agente de impresión
 * (optikt-print-agent) — CONTRATO V3. Módulo puro y testeable.
 *
 * Reglas de negocio (convenidas):
 * 1. Items se listan SIN IVA (base imponible / exento); el IVA se suma al final.
 * 2. Todo se calcula en montos POST-descuento (el descuento global ya fue
 *    aplicado: base/exento/iva se obtienen de los valores descontados).
 * 3. iva = baseImponible × taxRate/100 (redondeado 2 déc).
 * 4. total = exento + baseImponible + iva.
 * 5. exento/base en 0 se envían como 0 (el agente no imprime líneas en 0).
 * 6. Redondeo compensado: Σ items == subtotal == exento + baseImponible exacto.
 * 7. Cashea: si la venta es financiada se agrega {method:"Cashea"} por la
 *    parte NO cobrada, de modo que Σ payments == total.
 */
import { decomposePrice } from '$lib/shared/tax';
import { computeDiscount } from '$lib/utils';
import { fromISO } from '$lib/dates';

export interface TickeraRowInput {
	description: string;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: string;
	snapshotIsTaxable: boolean | null;
}

export interface TickeraPaymentInput {
	method: string; // label "listo para imprimir"
	amount: number; // monto en su moneda original
	isBs: boolean;
	amountBcvUsd: number | null; // equivalente USD-BCV (para convertir a Bs)
}

export interface TickeraSaleInput {
	store: { name: string | null; rif: string | null; address: string | null };
	orderNumber: number;
	saleDate: string;
	customerName: string;
	customerIdNumber: string | null;
	snapshotTaxRate: number;
	totalUsd: number;
	isCashea: boolean;
	rows: TickeraRowInput[];
	payments: TickeraPaymentInput[];
	bcvRate: number;
	footerMessage?: string | null;
}

export interface TickeraPayload {
	type: 'SALE';
	store: { name: string | null; rif: string | null; address: string | null };
	receiptNumber: number;
	date: string; // dd/mm/yy
	time: string; // HH:mm
	customer: string;
	customerIdNumber: string | null;
	items: { description: string; quantity: number; unitPrice: number; price: number }[];
	totals: {
		currency: 'Bs';
		subtotal: number;
		exento: number;
		baseImponible: number;
		taxRate: number | null;
		iva: number;
		total: number;
	};
	payments: { method: string; amount: number }[];
	footerMessage: string | null;
}

export function r2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Reparte `total` en `parts` proporcionalmente, redondeando a 2 decimales y
 * compensando el resto en el ÚLTIMO elemento: la suma da exacto.
 */
export function allocateRounded(total: number, parts: number[]): number[] {
	if (parts.length === 0) return [];
	const sum = parts.reduce((a, b) => a + b, 0);
	const result = parts.map((part) => r2(sum > 0 ? (part / sum) * total : 0));
	let diff = r2(total - result.reduce((a, b) => a + b, 0));
	for (let i = result.length - 1; i >= 0 && diff !== 0; i--) {
		result[i] = r2(result[i] + diff);
		diff = 0;
	}
	return result;
}

export function buildTickeraPayload(input: TickeraSaleInput): TickeraPayload {
	const { rows, payments, bcvRate, store } = input;
	const taxRate = input.snapshotTaxRate && input.snapshotTaxRate > 0 ? input.snapshotTaxRate : null;

	// ---- 1. Por unidad: base exclusiva o exento (USD), sin IVA ----
	type Unit = { isTaxable: boolean; unitExclusiveUsd: number };
	const units: Unit[] = [];
	let baseImponibleUsd = 0;
	let exentoUsd = 0;
	let ivaUsd = 0;

	for (const item of rows) {
		const lineExclusiveUsd =
			(item.unitPrice * item.quantity -
				computeDiscount(item.discount, item.discountType, item.unitPrice * item.quantity)) /
			item.quantity;
		const isTaxable = (item.snapshotIsTaxable ?? false) && taxRate !== null;

		if (isTaxable) {
			const { base } = decomposePrice(lineExclusiveUsd, taxRate!);
			baseImponibleUsd += base * item.quantity;
			ivaUsd += (lineExclusiveUsd - base) * item.quantity;
			for (let i = 0; i < item.quantity; i++)
				units.push({ isTaxable: true, unitExclusiveUsd: base });
		} else {
			exentoUsd += lineExclusiveUsd * item.quantity;
			for (let i = 0; i < item.quantity; i++)
				units.push({ isTaxable: false, unitExclusiveUsd: lineExclusiveUsd });
		}
	}

	// ---- 2. Descuento global: escala sobre montos post-descuento ----
	const itemsSubtotalUsd = baseImponibleUsd + exentoUsd + ivaUsd;
	const scale =
		itemsSubtotalUsd > 0 ? Math.min(1, Math.max(0, input.totalUsd / itemsSubtotalUsd)) : 1;

	// ---- 3. Totales en Bs (iva recalculado sobre la base final) ----
	const baseImponibleBs = r2(baseImponibleUsd * scale * bcvRate);
	const exentoBs = r2(exentoUsd * scale * bcvRate);
	const ivaBs = taxRate !== null ? r2((baseImponibleBs * taxRate) / 100) : 0;
	const subtotalBs = exentoBs + baseImponibleBs;
	const totalBs = subtotalBs + ivaBs;

	// ---- 4. Items SIN IVA en Bs, alocados pa cuadrar exacto ----
	const rawUnitBs = units.map((u) => u.unitExclusiveUsd * scale * bcvRate);
	const allocatedUnitBs = allocateRounded(subtotalBs, rawUnitBs);

	const items: TickeraPayload['items'] = [];
	let unitCursor = 0;
	for (const item of rows) {
		const prices = allocatedUnitBs.slice(unitCursor, unitCursor + item.quantity);
		unitCursor += item.quantity;
		const price = r2(prices.reduce((a, b) => a + b, 0));
		items.push({
			description: item.description,
			quantity: item.quantity,
			unitPrice: prices[0] ?? 0,
			price
		});
	}

	// ---- 5. Pagos en Bs ----
	const registeredBs = payments.map((p) => ({
		method: p.method,
		amount: r2(p.isBs ? p.amount : (p.amountBcvUsd ?? p.amount) * bcvRate)
	}));
	const paidBs = r2(registeredBs.reduce((a, p) => a + p.amount, 0));

	// ---- 6. Cashea: el financiado (no cobrado) figura en el recibo ----
	const casheaRemainderBs = input.isCashea ? r2(totalBs - paidBs) : 0;
	const tickeraPayments: TickeraPayload['payments'] =
		casheaRemainderBs > 0.01
			? [...registeredBs, { method: 'Cashea', amount: casheaRemainderBs }]
			: registeredBs;

	const d = fromISO(input.saleDate);
	const date = new Intl.DateTimeFormat('es-VE', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		timeZone: 'America/Caracas'
	}).format(d);
	const time = new Intl.DateTimeFormat('es-VE', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'America/Caracas'
	}).format(d);

	return {
		type: 'SALE',
		store: {
			name: store.name ?? null,
			rif: store.rif ?? null,
			address: store.address ?? null
		},
		receiptNumber: input.orderNumber,
		date,
		time,
		customer: input.customerName,
		customerIdNumber: input.customerIdNumber ?? null,
		items,
		totals: {
			currency: 'Bs',
			subtotal: subtotalBs,
			exento: exentoBs,
			baseImponible: baseImponibleBs,
			taxRate,
			iva: ivaBs,
			total: totalBs
		},
		payments: tickeraPayments,
		footerMessage: input.footerMessage ?? '¡Gracias por su compra!'
	};
}
