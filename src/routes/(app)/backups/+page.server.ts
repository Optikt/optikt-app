import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getRecentBackupNotifications } from '$lib/server/db/queries/notifications';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

	const history = await getRecentBackupNotifications(50);

	const initialStatus = computeStatus(history[0] ?? null);

	return {
		initialHistory: history,
		initialStatus
	};
};

function computeStatus(
	latest: { type: string; fileName: string | null; createdAt: string } | null
) {
	if (!latest) {
		return {
			status: 'unknown',
			label: 'Sin historial de backups',
			lastBackupAt: null,
			lastBackupFile: null,
			hoursSinceLastBackup: 0,
			isHealthy: false
		} as const;
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
		} as const;
	}

	if (isSuccess && hoursSinceLastBackup < 50) {
		return {
			status: 'stale',
			label: 'Último backup tiene más de 24 horas',
			lastBackupAt: latest.createdAt,
			lastBackupFile: latest.fileName,
			hoursSinceLastBackup: Math.round(hoursSinceLastBackup),
			isHealthy: false
		} as const;
	}

	const label = isSuccess
		? `Sin backups en ${Math.round(hoursSinceLastBackup)} horas`
		: 'El último backup falló';
	return {
		status: 'failing',
		label,
		lastBackupAt: latest.createdAt,
		lastBackupFile: latest.fileName,
		hoursSinceLastBackup: Math.round(hoursSinceLastBackup),
		isHealthy: false
	} as const;
}
