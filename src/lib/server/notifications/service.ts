import { NotificationSeverity, NotificationType, UserRole } from '$lib/shared/enums';
import type { NotificationLink } from '$lib/shared/notifications';
import {
	getExchangeRatesStaleThresholdMs,
	getExchangeRatesPollIntervalMs
} from '$lib/server/exchangeRates/service';
import {
	hasRecentNotificationOfType,
	insertNotification
} from '$lib/server/db/queries/notifications';
import type { Notification } from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { logger } from '$lib/utils/logger';

type PublishNotificationInput = {
	type: NotificationType;
	severity?: NotificationSeverity;
	title: string;
	body?: string;
	metadata?: Record<string, unknown>;
	targetRoles?: UserRole[];
	link?: NotificationLink;
};

async function publishNotification(
	input: PublishNotificationInput,
	executor?: DbOrTx
): Promise<Notification | null> {
	try {
		return await insertNotification(
			{
				type: input.type,
				severity: input.severity ?? NotificationSeverity.INFO,
				title: input.title,
				body: input.body ?? null,
				metadata: input.metadata ?? null,
				targetRoles: input.targetRoles ?? [],
				link: input.link ?? null
			},
			executor
		);
	} catch (error) {
		logger.error('No se pudo publicar la notificación', error);
		return null;
	}
}

export async function notifyStockLow(input: {
	productId: string;
	productName: string;
	currentStock: number;
	executor?: DbOrTx;
}) {
	return publishNotification(
		{
			type: NotificationType.STOCK_LOW,
			severity: NotificationSeverity.WARNING,
			title: `Stock bajo: ${input.productName}`,
			body: `Solo quedan ${input.currentStock} unidades disponibles.`,
			metadata: {
				productId: input.productId,
				productName: input.productName,
				currentStock: input.currentStock
			},
			targetRoles: [UserRole.ADMIN, UserRole.MANAGER],
			link: `/products/${input.productId}`
		},
		input.executor
	);
}

export async function notifyBackupCreated(input: {
	fileName: string;
	sizeBytes?: number;
	durationMs?: number;
	executor?: DbOrTx;
}) {
	return publishNotification(
		{
			type: NotificationType.BACKUP_CREATED,
			severity: NotificationSeverity.SUCCESS,
			title: 'Backup de base de datos creado',
			body: `Se generó el backup ${input.fileName}.`,
			metadata: {
				fileName: input.fileName,
				sizeBytes: input.sizeBytes ?? null,
				durationMs: input.durationMs ?? null
			},
			targetRoles: [UserRole.ADMIN]
		},
		input.executor
	);
}

export async function notifyBackupFailed(input: {
	fileName: string;
	error: string;
	executor?: DbOrTx;
}) {
	return publishNotification(
		{
			type: NotificationType.BACKUP_FAILED,
			severity: NotificationSeverity.ERROR,
			title: 'Backup de base de datos fallido',
			body: `El backup ${input.fileName} falló: ${input.error}.`,
			metadata: {
				fileName: input.fileName,
				error: input.error
			},
			targetRoles: [UserRole.ADMIN]
		},
		input.executor
	);
}

export async function notifyRatesUpdated(input: {
	refreshedAt: string;
	updatedKeys: string[];
	executor?: DbOrTx;
}) {
	const windowMs = Math.max(
		getExchangeRatesStaleThresholdMs(),
		getExchangeRatesPollIntervalMs() * 2
	);
	const sinceIso = new Date(Date.now() - windowMs).toISOString();
	const alreadyPublished = await hasRecentNotificationOfType(
		NotificationType.RATE_UPDATED,
		sinceIso,
		input.executor
	);
	if (alreadyPublished) return null;

	return publishNotification(
		{
			type: NotificationType.RATE_UPDATED,
			severity: NotificationSeverity.SUCCESS,
			title: 'Tasas de cambio actualizadas',
			body: `Se actualizaron ${input.updatedKeys.length} tasas en el proveedor externo.`,
			metadata: {
				refreshedAt: input.refreshedAt,
				updatedKeys: input.updatedKeys
			},
			targetRoles: [UserRole.ADMIN, UserRole.MANAGER]
		},
		input.executor
	);
}

export async function notifyRateOutdated(input: {
	lastFetchedAt: string | null;
	lastError: string | null;
	executor?: DbOrTx;
}) {
	const windowMs = Math.max(
		getExchangeRatesStaleThresholdMs(),
		getExchangeRatesPollIntervalMs() * 2
	);
	const sinceIso = new Date(Date.now() - windowMs).toISOString();
	const alreadyPublished = await hasRecentNotificationOfType(
		NotificationType.RATE_OUTDATED,
		sinceIso,
		input.executor
	);

	if (alreadyPublished) {
		return null;
	}

	return publishNotification(
		{
			type: NotificationType.RATE_OUTDATED,
			severity: NotificationSeverity.WARNING,
			title: 'Tasas de cambio desactualizadas',
			body: input.lastFetchedAt
				? 'No se ha podido refrescar la tasa de cambio dentro de la ventana esperada.'
				: 'Todavía no se han podido cargar tasas de cambio desde la API externa.',
			metadata: {
				lastFetchedAt: input.lastFetchedAt,
				lastError: input.lastError
			},
			targetRoles: [UserRole.ADMIN, UserRole.MANAGER]
		},
		input.executor
	);
}
