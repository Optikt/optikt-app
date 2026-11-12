import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createSaleItem, createUser } from '$lib/testing/integration/factories';
import {
	countSales,
	countSalesByStatus,
	getAllSales,
	getSalesStats,
	listSaleSellers,
	sumSalesForSelection
} from './reads';
import { SaleStatus } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { monthStart, toUTCString } from '$lib/dates';

/**
 * Consultas del listado de ventas (plan `sales-list-redesign`, fase 1).
 * Corre con Postgres real (project=integration, ver scripts/run-integration-tests.mjs).
 */
describe('consultas del listado de ventas', () => {
	beforeEach(async () => {
		await resetDb();
	});

	describe('getSalesStats', () => {
		it('cuenta total, estados, READY y "por cobrar" con tolerancia 0.01', async () => {
			// Pagada exacta → sin saldo
			await createSale({ total: 100, paidAmountBcvUsd: 100, status: SaleStatus.COMPLETED });
			// Abono parcial → saldo 150
			await createSale({ total: 200, paidAmountBcvUsd: 50, status: SaleStatus.PENDING });
			// Sin abono → saldo 300
			await createSale({ total: 300, paidAmountBcvUsd: 0, status: SaleStatus.READY });
			// Cancelada con deuda → NO entra en "por cobrar"
			await createSale({ total: 400, paidAmountBcvUsd: 0, status: SaleStatus.CANCELLED });
			// Debe dentro de la tolerancia (0.005) → cuenta como pagada
			await createSale({ total: 100, paidAmountBcvUsd: 99.995, status: SaleStatus.PENDING });

			const stats = await getSalesStats(toUTCString(monthStart()));

			expect(stats.total).toBe(5);
			expect(stats.pending).toBe(2);
			expect(stats.completed).toBe(1);
			expect(stats.cancelled).toBe(1);
			expect(stats.ready).toBe(1);

			expect(stats.receivableCount).toBe(2);
			expect(stats.receivableAmount).toBeCloseTo(450, 6);

			// "Mensuales" incluye todas las creadas este mes; el total USD excluye canceladas.
			expect(stats.monthly).toBe(5);
			expect(stats.monthlyTotalUsd).toBeCloseTo(700, 6);
		});

		it('reporta cero cuando no hay ventas', async () => {
			const stats = await getSalesStats(toUTCString(monthStart()));
			expect(stats).toEqual({
				total: 0,
				monthly: 0,
				monthlyTotalUsd: 0,
				pending: 0,
				completed: 0,
				cancelled: 0,
				ready: 0,
				receivableCount: 0,
				receivableAmount: 0
			});
		});
	});

	describe('countSalesByStatus (pestañas facetadas)', () => {
		it('respeta los demás filtros e ignora el filtro de estados', async () => {
			const seller = await createUser({ fullName: 'Vendedora Con Ventas' });
			await createSale({ status: SaleStatus.PENDING, sellerId: seller.id });
			await createSale({ status: SaleStatus.READY, sellerId: seller.id });
			await createSale({ status: SaleStatus.PENDING }); // otro vendedor

			const counts = await countSalesByStatus({ sellerId: seller.id });
			expect(counts[SaleStatus.PENDING]).toBe(1);
			expect(counts[SaleStatus.READY]).toBe(1);
			expect(counts[SaleStatus.COMPLETED]).toBe(0);
			expect(counts[SaleStatus.CANCELLED]).toBe(0);

			// El filtro de estados NO se aplica: la faceta lo ignora a propósito.
			const ignoringStatuses = await countSalesByStatus({ statuses: ['READY'] });
			expect(ignoringStatuses[SaleStatus.PENDING]).toBe(2);
			expect(ignoringStatuses[SaleStatus.READY]).toBe(1);
		});
	});

	describe('sumSalesForSelection (pie del listado)', () => {
		it('suma toda la selección y excluye canceladas', async () => {
			await createSale({ total: 100, paidAmountBcvUsd: 40 }); // saldo 60
			await createSale({ total: 200, paidAmountBcvUsd: 200 }); // saldo 0
			await createSale({ total: 300, paidAmountBcvUsd: 0, status: SaleStatus.CANCELLED });

			const summary = await sumSalesForSelection();
			expect(summary.count).toBe(2);
			expect(summary.totalUsd).toBeCloseTo(300, 6);
			expect(summary.balanceUsd).toBeCloseTo(60, 6);
		});
	});

	describe('filtro y orden por saldo', () => {
		it('balanceOnly deja solo no-canceladas con saldo > 0.01', async () => {
			await createSale({ total: 50, paidAmountBcvUsd: 0, status: SaleStatus.PENDING });
			await createSale({ total: 80, paidAmountBcvUsd: 80, status: SaleStatus.COMPLETED });
			await createSale({ total: 999, paidAmountBcvUsd: 0, status: SaleStatus.CANCELLED });

			expect(await countSales({ balanceOnly: true })).toBe(1);
			expect(await countSales({})).toBe(3);
		});

		it('orderBy balance ordena de mayor a menor saldo con canceladas al final', async () => {
			const low = await createSale({ total: 50, paidAmountBcvUsd: 0 });
			const high = await createSale({ total: 500, paidAmountBcvUsd: 100 });
			const paid = await createSale({ total: 80, paidAmountBcvUsd: 80 });
			const cancelled = await createSale({
				total: 999,
				paidAmountBcvUsd: 0,
				status: SaleStatus.CANCELLED
			});

			const ordered = await getAllSales({ orderBy: 'balance', orderSort: 'desc' });
			expect(ordered.map((s) => s.id)).toEqual([high.id, low.id, paid.id, cancelled.id]);
		});
	});

	describe('flags por fila', () => {
		it('expone hasShippingPending y hasFreeItem sin filtrar', async () => {
			const shipping = await createSale();
			await createSaleItem({ saleId: shipping.id, shippingCostPending: true });

			const free = await createSale();
			await createSaleItem({ saleId: free.id, itemType: SaleItemType.FREE_ITEM });

			const plain = await createSale();

			const rows = await getAllSales();
			const byId = new Map(rows.map((row) => [row.id, row]));

			expect(byId.get(shipping.id)?.hasShippingPending).toBe(true);
			expect(byId.get(shipping.id)?.hasFreeItem).toBe(false);
			expect(byId.get(free.id)?.hasFreeItem).toBe(true);
			expect(byId.get(free.id)?.hasShippingPending).toBe(false);
			expect(byId.get(plain.id)?.hasShippingPending).toBe(false);
			expect(byId.get(plain.id)?.hasFreeItem).toBe(false);
		});
	});

	describe('listSaleSellers', () => {
		it('devuelve solo vendedores con ventas no borradas', async () => {
			const withSales = await createUser({ fullName: 'Vendedora Con Ventas' });
			await createSale({ sellerId: withSales.id });
			const withoutSales = await createUser({ fullName: 'Vendedora Sin Ventas' });

			const sellers = await listSaleSellers();
			const ids = sellers.map((s) => s.id);

			expect(ids).toContain(withSales.id);
			expect(ids).not.toContain(withoutSales.id);
		});
	});
});
