import { describe, expect, it } from 'vitest';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import { saleRowActions, type SaleRowActionContext } from './saleRowActions';
import type { SaleListItem } from '$lib/server/db/queries/sales/types';

function ctx(overrides: Partial<SaleRowActionContext> = {}): SaleRowActionContext {
	return {
		canManage: true,
		currentUserId: 'user-1',
		currentUserRole: UserRole.ADMIN,
		...overrides
	};
}

function sale(overrides: Partial<SaleListItem> = {}): SaleListItem {
	return {
		id: 'sale-1',
		orderNumber: 306,
		status: SaleStatus.PENDING,
		sellerId: 'user-1',
		total: 100,
		paidAmountBcvUsd: 0,
		// Campos no usados por el helper, tipados como la fila real.
		...overrides
	} as SaleListItem;
}

const ids = (actions: ReturnType<typeof saleRowActions>) => actions.map((a) => a.id);

describe('saleRowActions', () => {
	it('VIEWER (sin gestión) solo ve "Ver detalle"', () => {
		const actions = saleRowActions(sale(), ctx({ canManage: false }));
		expect(ids(actions)).toEqual(['detail']);
	});

	it('PENDIENTE con saldo y ownership: acciones completas', () => {
		const actions = saleRowActions(sale(), ctx());
		expect(ids(actions)).toEqual(['detail', 'pay', 'status', 'cancel']);
	});

	it('cancelada: sin pago, sin estado y sin cancelar (ya es terminal)', () => {
		const actions = saleRowActions(sale({ status: SaleStatus.CANCELLED }), ctx());
		expect(ids(actions)).toEqual(['detail']);
	});

	it('completada pagada: sin pago (sin saldo) y sin cambiar estado', () => {
		const actions = saleRowActions(
			sale({ status: SaleStatus.COMPLETED, paidAmountBcvUsd: 100 }),
			ctx()
		);
		expect(ids(actions)).toEqual(['detail']);
	});

	it('pendiente subpagada de OTRO vendedor: solo SELLER no puede cancelar', () => {
		const actions = saleRowActions(
			sale({ sellerId: 'otro-vendedor' }),
			ctx({ currentUserRole: UserRole.SELLER })
		);
		expect(ids(actions)).toEqual(['detail', 'pay', 'status']);
	});

	it('cancelación solo en PENDING', () => {
		const actions = saleRowActions(sale({ status: SaleStatus.READY }), ctx());
		expect(ids(actions)).toEqual(['detail', 'pay', 'status']);
	});
});
