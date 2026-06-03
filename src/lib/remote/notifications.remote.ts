import { command, query } from '$app/server';
import { MarkNotificationReadSchema } from '$lib/schemas/notifications';
import {
	countUnreadNotificationsForUser,
	listNotificationsForUser,
	markAllNotificationsReadForUser,
	markNotificationRead,
	type NotificationListItem
} from '$lib/server/db/queries/notifications';
import { requireAuth } from '$lib/server/guards';
import { EmptySchema } from '$lib/schemas/common';

export const fetchMyNotifications = query(async (): Promise<NotificationListItem[]> => {
	const user = requireAuth();
	return listNotificationsForUser(user.id, user.role, { limit: 20 });
});

export const fetchUnreadNotificationsCount = query(async (): Promise<number> => {
	const user = requireAuth();
	return countUnreadNotificationsForUser(user.id, user.role);
});

export const markNotificationReadCommand = command(MarkNotificationReadSchema, async (data) => {
	const user = requireAuth();
	await markNotificationRead(data.id, user.id);
	return { success: true as const };
});

export const markAllNotificationsReadCommand = command(EmptySchema, async () => {
	const user = requireAuth();
	const count = await markAllNotificationsReadForUser(user.id, user.role);
	return { success: true as const, count };
});
