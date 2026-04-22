import type { HandleClientError } from '@sveltejs/kit';
import { reportClientError } from '$lib/utils';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	reportClientError('hooks.client', error, {
		status,
		message,
		url: event.url.href
	});

	return { message };
};