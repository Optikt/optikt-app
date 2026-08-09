/**
 * Backups Remote Functions
 * Super-admin only: backup history (from notifications), status, manual trigger via Dokploy API.
 */
import { command } from '$app/server';
import { env } from '$env/dynamic/private';
import { requireUserAdmin } from '$lib/server/guards';
import { EmptySchema } from '$lib/schemas/common';
import { z } from 'zod';
import {
	getRecentBackupNotifications,
	type BackupNotificationListItem
} from '$lib/server/db/queries/notifications';

const ListBackupHistorySchema = z.object({
	limit: z.number().int().min(1).max(100).optional().default(50)
});

export type BackupStatus =
	| {
			status: 'healthy';
			label: string;
			lastBackupAt: string | null;
			lastBackupFile: string | null;
			hoursSinceLastBackup: number;
			isHealthy: true;
	  }
	| {
			status: 'stale';
			label: string;
			lastBackupAt: string | null;
			lastBackupFile: string | null;
			hoursSinceLastBackup: number;
			isHealthy: false;
	  }
	| {
			status: 'failing';
			label: string;
			lastBackupAt: string | null;
			lastBackupFile: string | null;
			hoursSinceLastBackup: number;
			isHealthy: false;
	  }
	| {
			status: 'unknown';
			label: string;
			lastBackupAt: null;
			lastBackupFile: null;
			hoursSinceLastBackup: number;
			isHealthy: false;
	  };

export type BackupHistoryItem = BackupNotificationListItem;

export const listBackupHistory = command(
	ListBackupHistorySchema,
	async (input): Promise<BackupHistoryItem[]> => {
		requireUserAdmin();
		return getRecentBackupNotifications(input.limit);
	}
);

export const getBackupStatus = command(EmptySchema, async (): Promise<BackupStatus> => {
	requireUserAdmin();

	const [latest] = await getRecentBackupNotifications(1);

	if (!latest) {
		return {
			status: 'unknown',
			label: 'Sin historial de backups',
			lastBackupAt: null,
			lastBackupFile: null,
			hoursSinceLastBackup: 0,
			isHealthy: false
		};
	}

	const hoursSinceLastBackup =
		(Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
	const isSuccess = latest.type === 'BACKUP_CREATED';

	if (isSuccess && hoursSinceLastBackup < 26) {
		return {
			status: 'healthy',
			label: 'Backups funcionando correctamente',
			lastBackupAt: latest.createdAt,
			lastBackupFile: latest.fileName,
			hoursSinceLastBackup: Math.round(hoursSinceLastBackup),
			isHealthy: true
		};
	}

	if (isSuccess && hoursSinceLastBackup < 50) {
		return {
			status: 'stale',
			label: 'Último backup tiene más de 24 horas',
			lastBackupAt: latest.createdAt,
			lastBackupFile: latest.fileName,
			hoursSinceLastBackup: Math.round(hoursSinceLastBackup),
			isHealthy: false
		};
	}

	return {
		status: 'failing',
		label: isSuccess
			? `Sin backups en ${Math.round(hoursSinceLastBackup)} horas`
			: 'El último backup falló',
		lastBackupAt: latest.createdAt,
		lastBackupFile: latest.fileName,
		hoursSinceLastBackup: Math.round(hoursSinceLastBackup),
		isHealthy: false
	};
});

export const runBackup = command(
	EmptySchema,
	async (): Promise<{ success: true; message: string }> => {
		requireUserAdmin();

		const apiUrl = env.DOKPLOY_API_URL;
		const apiKey = env.DOKPLOY_API_KEY;
		const scheduleId = env.DOKPLOY_BACKUP_SCHEDULE_ID;

		if (!apiUrl || !apiKey || !scheduleId) {
			throw new Error(
				'Dokploy API no configurada. Configurar DOKPLOY_API_URL, DOKPLOY_API_KEY y DOKPLOY_BACKUP_SCHEDULE_ID.'
			);
		}

		const response = await fetch(`${apiUrl}/api/schedule/trigger`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey
			},
			body: JSON.stringify({ scheduleId })
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Dokploy API respondió con error (${response.status}): ${text}`);
		}

		return { success: true, message: 'Backup iniciado. Recibirás una notificación al completar.' };
	}
);
