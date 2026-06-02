import { sql } from 'drizzle-orm';
import {
	pgEnum,
	pgTable,
	varchar,
	uuid,
	timestamp,
	index,
	jsonb,
	foreignKey,
	primaryKey
} from 'drizzle-orm/pg-core';
import { NotificationSeverity, NotificationType, UserRole } from '../../../shared/enums';
import { enumValues } from './utils';
import { users } from './users';

export const notificationTypeEnum = pgEnum('notification_type', enumValues(NotificationType));
export const notificationSeverityEnum = pgEnum(
	'notification_severity',
	enumValues(NotificationSeverity)
);

export const notifications = pgTable(
	'notifications',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		type: notificationTypeEnum().notNull(),
		severity: notificationSeverityEnum().notNull().default(NotificationSeverity.INFO),
		title: varchar().notNull(),
		body: varchar(),
		metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
		targetRoles: varchar('target_roles')
			.array()
			.notNull()
			.default(sql`ARRAY[]::text[]`)
			.$type<UserRole[]>(),
		link: varchar(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_notifications_created_at').using(
			'btree',
			table.createdAt.desc().nullsLast().op('timestamptz_ops')
		),
		index('ix_notifications_type').using('btree', table.type.asc().nullsLast())
	]
);

export const notificationReads = pgTable(
	'notification_reads',
	{
		notificationId: uuid('notification_id').notNull(),
		userId: uuid('user_id').notNull(),
		readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
	},
	(table) => [
		primaryKey({
			columns: [table.notificationId, table.userId],
			name: 'notification_reads_pkey'
		}),
		index('ix_notification_reads_user_id').using(
			'btree',
			table.userId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_notification_reads_read_at').using(
			'btree',
			table.readAt.desc().nullsLast().op('timestamptz_ops')
		),
		foreignKey({
			columns: [table.notificationId],
			foreignColumns: [notifications.id],
			name: 'notification_reads_notification_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'notification_reads_user_id_fkey'
		}).onDelete('cascade')
	]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationRead = typeof notificationReads.$inferSelect;
export type NewNotificationRead = typeof notificationReads.$inferInsert;
