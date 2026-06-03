import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { NotificationSeverity, NotificationType, UserRole } from '$lib/shared/enums';
import { isNotificationLink, type NotificationLink } from '$lib/shared/notifications';
import { db } from '../index';
import {
	notificationReads,
	notifications,
	type NewNotification,
	type Notification,
	type NotificationRead
} from '../schema';
import type { DbOrTx } from '../types';

export type NotificationListItem = {
	id: string;
	type: NotificationType;
	severity: NotificationSeverity;
	title: string;
	body: string | null;
	metadata: Record<string, unknown> | null;
	targetRoles: UserRole[];
	link: NotificationLink | null;
	createdAt: string;
	readAt: string | null;
};

function visibilityCondition(role: UserRole) {
	return sql<boolean>`coalesce(array_length(${notifications.targetRoles}, 1), 0) = 0 or ${role} = any(${notifications.targetRoles})`;
}

export async function insertNotification(
	data: NewNotification,
	executor: DbOrTx = db
): Promise<Notification> {
	const [notification] = await executor
		.insert(notifications)
		.values({
			...data,
			body: data.body ?? null,
			metadata: data.metadata ?? null,
			link: data.link ?? null,
			targetRoles: data.targetRoles ?? []
		})
		.returning();

	return notification;
}

export async function listNotificationsForUser(
	userId: string,
	role: UserRole,
	options: { limit?: number } = {},
	executor: DbOrTx = db
): Promise<NotificationListItem[]> {
	const limit = options.limit ?? 20;

	const rows = await executor
		.select({
			id: notifications.id,
			type: notifications.type,
			severity: notifications.severity,
			title: notifications.title,
			body: notifications.body,
			metadata: notifications.metadata,
			targetRoles: notifications.targetRoles,
			link: notifications.link,
			createdAt: notifications.createdAt,
			readAt: notificationReads.readAt
		})
		.from(notifications)
		.leftJoin(
			notificationReads,
			and(
				eq(notificationReads.notificationId, notifications.id),
				eq(notificationReads.userId, userId)
			)
		)
		.where(visibilityCondition(role))
		.orderBy(desc(notifications.createdAt))
		.limit(limit);

	return rows.map((row) => ({
		...row,
		link: row.link && isNotificationLink(row.link) ? row.link : null,
		type: row.type as NotificationType,
		severity: row.severity as NotificationSeverity
	}));
}

export async function countUnreadNotificationsForUser(
	userId: string,
	role: UserRole,
	executor: DbOrTx = db
): Promise<number> {
	const [result] = await executor
		.select({ count: sql<number>`count(*)::int` })
		.from(notifications)
		.leftJoin(
			notificationReads,
			and(
				eq(notificationReads.notificationId, notifications.id),
				eq(notificationReads.userId, userId)
			)
		)
		.where(
			and(visibilityCondition(role), sql<boolean>`${notificationReads.notificationId} is null`)
		);

	return result?.count ?? 0;
}

export async function markNotificationRead(
	notificationId: string,
	userId: string,
	executor: DbOrTx = db
): Promise<NotificationRead | null> {
	const [read] = await executor
		.insert(notificationReads)
		.values({ notificationId, userId })
		.onConflictDoNothing()
		.returning();

	return read ?? null;
}

export async function markAllNotificationsReadForUser(
	userId: string,
	role: UserRole,
	executor: DbOrTx = db
): Promise<number> {
	const unread = await executor
		.select({ notificationId: notifications.id })
		.from(notifications)
		.leftJoin(
			notificationReads,
			and(
				eq(notificationReads.notificationId, notifications.id),
				eq(notificationReads.userId, userId)
			)
		)
		.where(
			and(visibilityCondition(role), sql<boolean>`${notificationReads.notificationId} is null`)
		);

	if (unread.length === 0) {
		return 0;
	}

	await executor
		.insert(notificationReads)
		.values(unread.map((notification) => ({ notificationId: notification.notificationId, userId })))
		.onConflictDoNothing();

	return unread.length;
}

export async function hasRecentNotificationOfType(
	type: NotificationType,
	sinceIso: string,
	executor: DbOrTx = db
): Promise<boolean> {
	const [notification] = await executor
		.select({ id: notifications.id })
		.from(notifications)
		.where(and(eq(notifications.type, type), gte(notifications.createdAt, sinceIso)))
		.limit(1);

	return Boolean(notification);
}
