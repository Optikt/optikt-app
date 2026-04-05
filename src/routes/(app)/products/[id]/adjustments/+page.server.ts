import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const data = await parent();
	return {
		product: data.product,
		activeLots: data.activeLots
	};
};
