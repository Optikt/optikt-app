import { getAuditContext } from '#lib/server/audit/index.js';
import type { UserRole } from '#lib/shared/enums/index.js';

export interface ActionContext {
	userId: string | null;
	role: UserRole;
	ipAddress: string | null;
	userAgent: string | null;
}

export function getActionContext(user: { role: UserRole }): ActionContext {
	const audit = getAuditContext();
	return {
		userId: audit.userId ?? null,
		role: user.role,
		ipAddress: audit.ipAddress ?? null,
		userAgent: audit.userAgent ?? null
	};
}
