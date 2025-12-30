import { redirect } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		if (!event.locals.session) {
			redirect(302, '/login');
		}

		await auth.invalidateSession(event.locals.session.id);
		auth.deleteSessionTokenCookie(event);

		redirect(302, '/login');
	}
};
