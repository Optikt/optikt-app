/**
 * Support ticket enums shared between client and server.
 */

export enum TicketCategory {
	BUG = 'BUG',
	INCONSISTENCY = 'INCONSISTENCY',
	QUESTION = 'QUESTION',
	IMPROVEMENT = 'IMPROVEMENT',
	OTHER = 'OTHER'
}

export const ALL_TICKET_CATEGORIES = Object.values(TicketCategory);

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
	[TicketCategory.BUG]: 'Error',
	[TicketCategory.INCONSISTENCY]: 'Inconsistencia',
	[TicketCategory.QUESTION]: 'Duda / ayuda',
	[TicketCategory.IMPROVEMENT]: 'Mejora',
	[TicketCategory.OTHER]: 'Otro'
};

export enum TicketPriority {
	LOW = 'LOW',
	MEDIUM = 'MEDIUM',
	HIGH = 'HIGH',
	URGENT = 'URGENT'
}

export const ALL_TICKET_PRIORITIES = Object.values(TicketPriority);

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
	[TicketPriority.LOW]: 'Baja',
	[TicketPriority.MEDIUM]: 'Media',
	[TicketPriority.HIGH]: 'Alta',
	[TicketPriority.URGENT]: 'Urgente'
};

export enum TicketStatus {
	OPEN = 'OPEN',
	IN_PROGRESS = 'IN_PROGRESS',
	RESOLVED = 'RESOLVED',
	DISMISSED = 'DISMISSED'
}

export const ALL_TICKET_STATUSES = Object.values(TicketStatus);

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
	[TicketStatus.OPEN]: 'Abierto',
	[TicketStatus.IN_PROGRESS]: 'En progreso',
	[TicketStatus.RESOLVED]: 'Resuelto',
	[TicketStatus.DISMISSED]: 'Descartado'
};

export enum TicketActivityKind {
	COMMENT = 'COMMENT',
	CHANGE = 'CHANGE'
}

export enum TicketRelatedType {
	SALE = 'SALE',
	CUSTOMER = 'CUSTOMER',
	PRODUCT = 'PRODUCT',
	PURCHASES = 'PURCHASES',
	CASH = 'CASH',
	LENSES = 'LENSES',
	QUOTES = 'QUOTES',
	USERS = 'USERS',
	INVENTORY = 'INVENTORY',
	REPORTS = 'REPORTS',
	OTHER = 'OTHER'
}

export const ALL_TICKET_RELATED_TYPES = Object.values(TicketRelatedType);

export const TICKET_RELATED_TYPE_LABELS: Record<TicketRelatedType, string> = {
	[TicketRelatedType.SALE]: 'Ventas',
	[TicketRelatedType.CUSTOMER]: 'Clientes',
	[TicketRelatedType.PRODUCT]: 'Productos',
	[TicketRelatedType.PURCHASES]: 'Compras',
	[TicketRelatedType.CASH]: 'Caja / Balance',
	[TicketRelatedType.LENSES]: 'Cristales / Lentes',
	[TicketRelatedType.QUOTES]: 'Presupuestos',
	[TicketRelatedType.USERS]: 'Usuarios',
	[TicketRelatedType.INVENTORY]: 'Conteo físico / Inventario',
	[TicketRelatedType.REPORTS]: 'Reportes',
	[TicketRelatedType.OTHER]: 'Otro'
};
