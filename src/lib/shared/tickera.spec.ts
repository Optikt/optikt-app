import { describe, expect, it } from 'vitest';
import { allocateRounded, buildTickeraPayload, r2, type TickeraSaleInput } from './tickera';

function baseInput(overrides: Partial<TickeraSaleInput> = {}): TickeraSaleInput {
	return {
		store: { name: 'Optikt Monagas C.A', rif: 'J-50736591-3', address: 'Maturin, Monagas' },
		orderNumber: 152,
		saleDate: '2026-08-18T18:30:00.000Z',
		customerName: 'Juan Rodriguez',
		customerIdNumber: 'V-12.345.678',
		snapshotTaxRate: 16,
		totalUsd: 316.8,
		isCashea: false,
		rows: [
			{
				description: 'Item Exento',
				quantity: 1,
				unitPrice: 50,
				discount: 0,
				discountType: 'FIXED',
				snapshotIsTaxable: false
			},
			{
				description: 'Cristal Monofocal CR-39',
				quantity: 1,
				unitPrice: 266.8,
				discount: 0,
				discountType: 'FIXED',
				snapshotIsTaxable: true
			}
		],
		payments: [{ method: 'Pago Movil', amount: 316.8, isBs: true, amountBcvUsd: null }],
		bcvRate: 1,
		...overrides
	};
}

describe('buildTickeraPayload — contrato V3', () => {
	it('calcula exento/base/iva/total del ejemplo del contrato (rate=1)', () => {
		const p = buildTickeraPayload(baseInput());

		expect(p.totals.exento).toBe(50);
		expect(p.totals.baseImponible).toBe(230);
		expect(p.totals.iva).toBe(36.8); // 230 × 16%
		expect(p.totals.subtotal).toBe(280); // exento + base
		expect(p.totals.total).toBe(316.8); // subtotal + iva

		// items sin IVA: Σ == subtotal exacto
		const sumItems = p.items.reduce((acc, it) => acc + it.price, 0);
		expect(sumItems).toBe(p.totals.subtotal);
		expect(p.items.map((it) => it.price)).toEqual([50, 230]);
	});

	it('convierte todo a Bs con la tasa BCV', () => {
		const p = buildTickeraPayload(baseInput({ bcvRate: 40 }));

		expect(p.totals.exento).toBe(2000);
		expect(p.totals.baseImponible).toBe(9200);
		expect(p.totals.iva).toBe(1472); // 9200 × 16%
		expect(p.totals.subtotal).toBe(11200);
		expect(p.totals.total).toBe(12672);

		const sumItems = p.items.reduce((acc, it) => acc + it.price, 0);
		expect(sumItems).toBe(p.totals.subtotal);

		// items: unit price sin IVA
		expect(p.items.map((it) => it.price)).toEqual([2000, 9200]);
		expect(p.totals.currency).toBe('Bs');
	});

	it('descuento global: escala post-descuento, todo cuadra exacto', () => {
		const p = buildTickeraPayload(baseInput({ totalUsd: 300 })); // descuento de 16.8 USD

		// invariantes exactas
		expect(p.totals.subtotal).toBe(p.totals.exento + p.totals.baseImponible);
		expect(p.totals.total).toBe(p.totals.subtotal + p.totals.iva);
		expect(p.totals.iva).toBe(r2((p.totals.baseImponible * 16) / 100));

		const sumItems = p.items.reduce((acc, it) => acc + it.price, 0);
		expect(sumItems).toBe(p.totals.subtotal);
	});

	it('sin items exentos → exento = 0; sin base → base = 0 e iva = 0', () => {
		const taxable = buildTickeraPayload(baseInput({ rows: baseInput().rows.slice(1) }));
		expect(taxable.totals.exento).toBe(0);
		expect(taxable.totals.baseImponible).toBe(230);

		const exempt = buildTickeraPayload(baseInput({ rows: baseInput().rows.slice(0, 1) }));
		expect(exempt.totals.baseImponible).toBe(0);
		expect(exempt.totals.iva).toBe(0);
		expect(exempt.totals.total).toBe(exempt.totals.exento);
	});

	it('Cashea: agrega el financiado y Σ payments == total', () => {
		const p = buildTickeraPayload(
			baseInput({
				isCashea: true,
				payments: [{ method: 'Pago Movil', amount: 100, isBs: true, amountBcvUsd: null }]
			})
		);

		expect(p.payments).toEqual([
			{ method: 'Pago Movil', amount: 100 },
			{ method: 'Cashea', amount: 216.8 }
		]);
		const sumPayments = p.payments.reduce((acc, pm) => acc + pm.amount, 0);
		expect(sumPayments).toBe(p.totals.total);
	});

	it('Cashea sin saldo financiado → no agrega línea', () => {
		const p = buildTickeraPayload(baseInput({ isCashea: true }));
		expect(p.payments).toEqual([{ method: 'Pago Movil', amount: 316.8 }]);
	});

	it('pago en USD se convierte a Bs por amountBcvUsd', () => {
		const p = buildTickeraPayload(
			baseInput({
				payments: [{ method: 'Efectivo $', amount: 316.8, isBs: false, amountBcvUsd: 316.8 }]
			})
		);
		expect(p.payments).toEqual([{ method: 'Efectivo $', amount: 316.8 }]);
	});

	it('redondeo compensado con qty > 1 y varios items', () => {
		const p = buildTickeraPayload(
			baseInput({
				totalUsd: 984.1,
				rows: [
					{
						description: 'A',
						quantity: 3,
						unitPrice: 100,
						discount: 0,
						discountType: 'FIXED',
						snapshotIsTaxable: true
					},
					{
						description: 'B',
						quantity: 2,
						unitPrice: 250.5,
						discount: 0,
						discountType: 'FIXED',
						snapshotIsTaxable: true
					},
					{
						description: 'C',
						quantity: 1,
						unitPrice: 80,
						discount: 0,
						discountType: 'FIXED',
						snapshotIsTaxable: false
					}
				]
			})
		);

		const sumItems = p.items.reduce((acc, it) => acc + it.price, 0);
		expect(sumItems).toBe(p.totals.subtotal);
		expect(p.totals.subtotal).toBe(p.totals.exento + p.totals.baseImponible);
		expect(p.totals.total).toBe(p.totals.subtotal + p.totals.iva);

		// precios unitarios a 2 decimales, price == qty × unit siguiendo la alocación
		for (const it of p.items) {
			expect(Math.abs(it.price - it.unitPrice * it.quantity)).toBeLessThanOrEqual(0.02);
		}
	});

	it('NO envía campos viejos (cashier, tax, discount, paid, change, phone, website)', () => {
		const p = buildTickeraPayload(baseInput()) as unknown as Record<string, unknown>;
		expect(p).not.toHaveProperty('cashier');
		expect(p.totals).not.toHaveProperty('tax');
		expect(p.totals).not.toHaveProperty('discount');
		expect(p.totals).not.toHaveProperty('paid');
		expect(p.totals).not.toHaveProperty('change');
		expect(p.store).not.toHaveProperty('phone');
		expect(p.store).not.toHaveProperty('website');
	});

	it('fecha/tiempo separados en dd/mm/yy y HH:mm', () => {
		const p = buildTickeraPayload(baseInput({ saleDate: '2026-08-18T18:30:00.000Z' }));
		expect(p.date).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
		expect(p.time).toMatch(/^\d{2}:\d{2}$/);
	});

	it('store completo como respaldo del agente', () => {
		const p = buildTickeraPayload(baseInput());
		expect(p.store.name).toBe('Optikt Monagas C.A');
		expect(p.store.rif).toBe('J-50736591-3');
		expect(p.store.address).toBe('Maturin, Monagas');
	});
});

describe('allocateRounded', () => {
	it('suma exacta con redondeo de 2 decimales', () => {
		const parts = allocateRounded(100, [33.333, 33.333, 33.334]);
		expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
	});

	it('compensa en el último elemento', () => {
		const parts = allocateRounded(10.01, [10, 0.005]);
		expect(parts[0] + parts[1]).toBe(10.01);
	});
});
