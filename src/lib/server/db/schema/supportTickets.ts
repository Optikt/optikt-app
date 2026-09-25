import {
	pgEnum,
	pgTable,
	varchar,
	uuid,
	timestamp,
	serial,
	index,
	uniqueIndex,
	foreignKey
} from 'drizzle-orm/pg-core';
import {
	TicketCategory,
	TicketPriority,
	TicketRelatedType,
	TicketStatus
} from '../../../shared/enums/supportTickets';
import { enumValues } from './utils';
import { users } from './users';

export const supportTicketCategoryEnum = pgEnum(
	'support_ticket_category',
	enumValues(TicketCategory)
);
export const supportTicketPriorityEnum = pgEnum(
	'support_ticket_priority',
	enumValues(TicketPriority)
);
export const supportTicketStatusEnum = pgEnum('support_ticket_status', enumValues(TicketStatus));
export const supportTicketRelatedTypeEnum = pgEnum(
	'support_ticket_related_type',
	enumValues(TicketRelatedType)
);

export const supportTickets = pgTable(
	'support_tickets',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		number: serial().notNull(),
		title: varchar().notNull(),
		description: varchar().notNull(),
		category: supportTicketCategoryEnum().notNull().default(TicketCategory.BUG),
		priority: supportTicketPriorityEnum().notNull().default(TicketPriority.MEDIUM),
		status: supportTicketStatusEnum().notNull().default(TicketStatus.OPEN),
		createdById: uuid('created_by_id').notNull(),
		resolvedById: uuid('resolved_by_id'),
		resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
		relatedType: supportTicketRelatedTypeEnum('related_type'),
		relatedLabel: varchar('related_label'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('ix_support_tickets_number').on(table.number),
		index('ix_support_tickets_status_created_at').on(table.status, table.createdAt.desc()),
		index('ix_support_tickets_created_by_id').on(table.createdById),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: 'support_tickets_created_by_id_fkey'
		}),
		foreignKey({
			columns: [table.resolvedById],
			foreignColumns: [users.id],
			name: 'support_tickets_resolved_by_id_fkey'
		}).onDelete('set null')
	]
);

export const supportTicketComments = pgTable(
	'support_ticket_comments',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		ticketId: uuid('ticket_id').notNull(),
		authorId: uuid('author_id').notNull(),
		body: varchar().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_support_ticket_comments_ticket_id').on(table.ticketId, table.createdAt),
		foreignKey({
			columns: [table.ticketId],
			foreignColumns: [supportTickets.id],
			name: 'support_ticket_comments_ticket_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: 'support_ticket_comments_author_id_fkey'
		})
	]
);

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type SupportTicketComment = typeof supportTicketComments.$inferSelect;
export type NewSupportTicketComment = typeof supportTicketComments.$inferInsert;
