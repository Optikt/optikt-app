import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { nowISO } from '$lib/dates';
import {
	type TicketCategory,
	type TicketPriority,
	type TicketRelatedType,
	type TicketStatus
} from '$lib/shared/enums';
import { OPEN_SUPPORT_TICKET_STATUSES } from '$lib/shared/supportTickets';
import type { PaginatedResult } from '$lib/types';
import { db } from '../index';
import {
	supportTicketComments,
	supportTickets,
	type SupportTicket,
	type SupportTicketComment
} from '../schema';
import type { DbOrTx } from '../types';
import { users } from '../schema/users';

const createdByUser = alias(users, 'support_ticket_created_by_user');
const resolvedByUser = alias(users, 'support_ticket_resolved_by_user');

const ticketSelection = {
	id: supportTickets.id,
	number: supportTickets.number,
	title: supportTickets.title,
	description: supportTickets.description,
	category: supportTickets.category,
	priority: supportTickets.priority,
	status: supportTickets.status,
	createdById: supportTickets.createdById,
	createdByName: createdByUser.fullName,
	resolvedById: supportTickets.resolvedById,
	resolvedByName: resolvedByUser.fullName,
	resolvedAt: supportTickets.resolvedAt,
	relatedType: supportTickets.relatedType,
	relatedLabel: supportTickets.relatedLabel,
	createdAt: supportTickets.createdAt,
	updatedAt: supportTickets.updatedAt
} as const;

type TicketSelectRow = {
	id: string;
	number: number;
	title: string;
	description: string;
	category: string;
	priority: string;
	status: string;
	createdById: string;
	createdByName: string | null;
	resolvedById: string | null;
	resolvedByName: string | null;
	resolvedAt: string | null;
	relatedType: string | null;
	relatedLabel: string | null;
	createdAt: string;
	updatedAt: string;
};

export type SupportTicketRow = Omit<
	TicketSelectRow,
	'category' | 'priority' | 'status' | 'relatedType'
> & {
	category: TicketCategory;
	priority: TicketPriority;
	status: TicketStatus;
	relatedType: TicketRelatedType | null;
};

function ticketQuery(executor: DbOrTx) {
	return executor
		.select(ticketSelection)
		.from(supportTickets)
		.innerJoin(createdByUser, eq(createdByUser.id, supportTickets.createdById))
		.leftJoin(resolvedByUser, eq(resolvedByUser.id, supportTickets.resolvedById));
}

function mapTicketRow(row: TicketSelectRow): SupportTicketRow {
	return {
		...row,
		category: row.category as TicketCategory,
		priority: row.priority as TicketPriority,
		status: row.status as TicketStatus,
		relatedType: (row.relatedType ?? null) as TicketRelatedType | null
	};
}

export interface SupportTicketFilters {
	status?: TicketStatus;
	category?: TicketCategory;
	priority?: TicketPriority;
	search?: string;
	createdById?: string;
	page?: number;
	perPage?: number;
}

export async function listSupportTickets(
	filters: SupportTicketFilters = {},
	executor: DbOrTx = db
): Promise<PaginatedResult<SupportTicketRow>> {
	const page = filters.page ?? 1;
	const perPage = Math.min(filters.perPage ?? 10, 50);

	const conditions: SQL[] = [];

	if (filters.status) conditions.push(eq(supportTickets.status, filters.status));
	if (filters.category) conditions.push(eq(supportTickets.category, filters.category));
	if (filters.priority) conditions.push(eq(supportTickets.priority, filters.priority));
	if (filters.createdById) conditions.push(eq(supportTickets.createdById, filters.createdById));

	if (filters.search) {
		const pattern = `%${filters.search}%`;
		const searchCondition = or(
			ilike(supportTickets.title, pattern),
			ilike(supportTickets.description, pattern),
			sql`${supportTickets.number}::text ilike ${pattern}`
		);
		if (searchCondition) conditions.push(searchCondition);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [rows, countRows] = await Promise.all([
		ticketQuery(executor)
			.where(where)
			.orderBy(desc(supportTickets.createdAt))
			.limit(perPage)
			.offset((page - 1) * perPage),
		executor
			.select({ count: sql<number>`count(*)::int` })
			.from(supportTickets)
			.where(where)
	]);

	const total = countRows[0]?.count ?? 0;

	return {
		items: rows.map(mapTicketRow),
		total,
		page,
		perPage,
		totalPages: Math.ceil(total / perPage)
	};
}

export async function findSupportTicketById(
	id: string,
	executor: DbOrTx = db
): Promise<SupportTicketRow | null> {
	const rows = await ticketQuery(executor).where(eq(supportTickets.id, id)).limit(1);
	const [row] = rows;
	return row ? mapTicketRow(row) : null;
}

export interface NewSupportTicketData {
	title: string;
	description: string;
	category: TicketCategory;
	priority: TicketPriority;
	relatedType?: TicketRelatedType | null;
	relatedLabel?: string | null;
	createdById: string;
}

export async function createSupportTicket(
	data: NewSupportTicketData,
	executor: DbOrTx = db
): Promise<SupportTicket> {
	const [ticket] = await executor
		.insert(supportTickets)
		.values({
			title: data.title.trim(),
			description: data.description.trim(),
			category: data.category,
			priority: data.priority,
			relatedType: data.relatedType ?? null,
			relatedLabel: data.relatedLabel?.trim() || null,
			createdById: data.createdById
		})
		.returning();

	return ticket;
}

export interface SupportTicketUpdate {
	status: TicketStatus;
	priority: TicketPriority;
}

export async function updateSupportTicket(
	id: string,
	patch: SupportTicketUpdate,
	resolvedById: string,
	executor: DbOrTx = db
): Promise<SupportTicket | null> {
	const isTerminal = patch.status === 'RESOLVED' || patch.status === 'DISMISSED';

	const [updated] = await executor
		.update(supportTickets)
		.set({
			status: patch.status,
			priority: patch.priority,
			updatedAt: nowISO(),
			resolvedById: isTerminal ? resolvedById : null,
			resolvedAt: isTerminal ? nowISO() : null
		})
		.where(eq(supportTickets.id, id))
		.returning();

	return updated ?? null;
}

export async function countOpenSupportTickets(executor: DbOrTx = db): Promise<number> {
	const [result] = await executor
		.select({ count: sql<number>`count(*)::int` })
		.from(supportTickets)
		.where(inArray(supportTickets.status, [...OPEN_SUPPORT_TICKET_STATUSES]));

	return result?.count ?? 0;
}

export type SupportTicketCommentRow = {
	id: string;
	ticketId: string;
	authorId: string;
	authorName: string | null;
	body: string;
	createdAt: string;
};

export async function listSupportTicketComments(
	ticketId: string,
	executor: DbOrTx = db
): Promise<SupportTicketCommentRow[]> {
	return executor
		.select({
			id: supportTicketComments.id,
			ticketId: supportTicketComments.ticketId,
			authorId: supportTicketComments.authorId,
			authorName: users.fullName,
			body: supportTicketComments.body,
			createdAt: supportTicketComments.createdAt
		})
		.from(supportTicketComments)
		.innerJoin(users, eq(users.id, supportTicketComments.authorId))
		.where(eq(supportTicketComments.ticketId, ticketId))
		.orderBy(supportTicketComments.createdAt);
}

export interface NewSupportTicketCommentData {
	ticketId: string;
	authorId: string;
	body: string;
}

export async function addSupportTicketComment(
	data: NewSupportTicketCommentData,
	executor: DbOrTx = db
): Promise<SupportTicketComment> {
	const [comment] = await executor
		.insert(supportTicketComments)
		.values({
			ticketId: data.ticketId,
			authorId: data.authorId,
			body: data.body.trim()
		})
		.returning();

	return comment;
}
