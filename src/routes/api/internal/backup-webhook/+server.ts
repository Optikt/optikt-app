import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { notifyBackupCreated } from '$lib/server/notifications/service';
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

	let body: { filename?: string; size?: string; timestamp?: string; status?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}

	if (!body.filename) {
		error(400, 'Missing filename');
	}

	await notifyBackupCreated({ fileName: body.filename });

	return json({ ok: true });
};
