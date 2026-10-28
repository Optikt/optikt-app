/**
 * Sales remote — sale payments
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/*.
 */
import { command } from '$app/server';
import { requireRole } from '#lib/server/guards.js';
import { AddPaymentSchema, VoidPaymentSchema } from '#lib/schemas//index.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getActionContext } from '#lib/server/actionContext.js';
import { addSalePaymentCore } from '#lib/server/sales/addSalePayment.js';
import { voidSalePaymentCore } from '#lib/server/sales/voidSalePayment.js';

export const addPayment = command(AddPaymentSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return addSalePaymentCore(data, getActionContext(user));
});

export const voidPayment = command(VoidPaymentSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return voidSalePaymentCore(data, getActionContext(user));
});
