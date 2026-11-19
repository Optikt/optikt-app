/**
 * Preferencia «Lista / Cuadros» del perfil. UNA sola llave para ventas y
 * presupuestos: cambiar la vista en un listado la cambia en el otro.
 */
import { toast } from 'svelte-sonner';
import { saveUserPreference } from '$lib/remote/users/preferences.remote';
import { logger } from '$lib/utils/logger';
import { LIST_VIEW_PREFERENCE_KEY, type SaleListView } from './listParams';

export { LIST_VIEW_PREFERENCE_KEY };

/** ID fijo: el toast se actualiza en vez de apilarse (si ya cerró, se crea uno). */
const VIEW_TOAST_ID = 'sales.view.toast';

/** Reintento silencioso tras un fallo (la vista ya cambió en pantalla). */
export const LIST_VIEW_RETRY_MS = 1500;

/** Guarda la vista en el perfil; `false` si falló (programa un reintento silencioso). */
export async function persistListView(next: SaleListView): Promise<boolean> {
	try {
		await saveUserPreference({ key: LIST_VIEW_PREFERENCE_KEY, value: next });
		const label = next === 'list' ? 'Lista' : 'Cuadros';
		toast.success(`Vista «${label}» guardada en tu perfil`, { id: VIEW_TOAST_ID });
		return true;
	} catch (e) {
		logger.error('No se pudo guardar la preferencia de vista', e);
		setTimeout(() => {
			void saveUserPreference({ key: LIST_VIEW_PREFERENCE_KEY, value: next }).catch(
				() => undefined
			);
		}, LIST_VIEW_RETRY_MS);
		return false;
	}
}
