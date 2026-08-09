import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { notifyBackupCreated, notifyBackupFailed } from '$lib/server/notifications/service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const token = env.BACKUP_NOTIFY_TOKEN;

	if (!token) {
		error(503, 'Webhook not configured');
	}

	const authHeader = request.headers.get('Authorization');
	if (authHeader !== `Bearer ${token}`) {
		error(401, 'Unauthorized');
	}

	let body: { filename?: string; size?: string; status?: string; error?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}

	if (!body.filename) {
		error(400, 'Missing filename');
	}

	const status = body.status ?? 'success';
	const sizeBytes = body.size ? parseSize(body.size) : undefined;

	if (status === 'error') {
		await notifyBackupFailed({
			fileName: body.filename,
			error: body.error || 'Error desconocido'
		});
	} else {
		await notifyBackupCreated({
			fileName: body.filename,
			sizeBytes
		});
	}

	return json({ ok: true });
};

function parseSize(raw: string): number | undefined {
	const match = raw.match(/^([\d.]+)\s*([KMG]?B?)$/i);
	if (!match) return undefined;
	const value = parseFloat(match[1]);
	const unit = match[2].toUpperCase();
	const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
	const multiplier = multipliers[unit] ?? multipliers[unit + 'B'] ?? 1;
	return Math.round(value * multiplier);
}
