/**
 * Acciones disponibles del menú ⋯ de una venta en el listado.
 *
 * Única fuente del gating (antes inline en `SaleRowMenu`): lo consumen el
 * DropdownMenu de escritorio y la hoja inferior de acciones móvil — mismas
 * reglas, dos presentaciones.
 *
 * Reglas (spec listado v2 + dominio sales):
 * - Ver detalle: siempre.
 * - Registrar pago: gestionable y venta no cancelada con saldo > 0.01.
 * - Cambiar estado: gestionable y estado ni CANCELLED ni COMPLETED.
 * - Cancelar venta: gestionable + estado PENDING + ownership
 *   (`canManageSaleByOwner`). Abre `CancelSaleModal` (motivo + reembolso).
 */
import { SaleStatus, canManageSaleByOwner, type UserRole } from '$lib/shared/enums';
import { isSaleCancelled, saleHasBalance } from '$lib/shared/saleBalance';
import type { SaleListItem } from '$lib/server/db/queries/sales/types';

export type SaleRowActionId = 'detail' | 'pay' | 'status' | 'cancel';

export interface SaleRowAction {
	id: SaleRowActionId;
	label: string;
	/** Descripción corta (subtítulo en la hoja móvil). */
	description?: string;
	/** La acción cancel es destructiva: fila roja en la hoja móvil. */
	danger?: boolean;
}

export interface SaleRowActionContext {
	/** `canOperate(role)` del listado (VIEWER = false). */
	canManage: boolean;
	currentUserId?: string;
	currentUserRole?: UserRole;
}

export function saleRowActions(sale: SaleListItem, ctx: SaleRowActionContext): SaleRowAction[] {
	const actions: SaleRowAction[] = [{ id: 'detail', label: 'Ver detalle' }];

	if (ctx.canManage && !isSaleCancelled(sale) && saleHasBalance(sale)) {
		actions.push({
			id: 'pay',
			label: 'Registrar pago',
			description: 'Abre la venta y su drawer de pago'
		});
	}

	if (
		ctx.canManage &&
		sale.status !== SaleStatus.CANCELLED &&
		sale.status !== SaleStatus.COMPLETED
	) {
		actions.push({
			id: 'status',
			label: 'Cambiar estado',
			description: 'Abre la venta y el modal de estado'
		});
	}

	if (
		ctx.canManage &&
		sale.status === SaleStatus.PENDING &&
		canManageSaleByOwner(ctx.currentUserRole, ctx.currentUserId, sale.sellerId)
	) {
		actions.push({ id: 'cancel', label: 'Cancelar venta', danger: true });
	}

	return actions;
}
