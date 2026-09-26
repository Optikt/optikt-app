export type NotificationLink = `/products/${string}` | `/support/${string}`;

export function isNotificationLink(value: string): value is NotificationLink {
	return (
		(value.startsWith('/products/') && value.length > '/products/'.length) ||
		(value.startsWith('/support/') && value.length > '/support/'.length)
	);
}
