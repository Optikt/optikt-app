export type NotificationLink = `/products/${string}`;

export function isNotificationLink(value: string): value is NotificationLink {
	return value.startsWith('/products/') && value.length > '/products/'.length;
}
