import { TreatmentCategory } from '$lib/shared/enums';

export function treatmentCategoryBadgeClass(category: string): string {
	return category === TreatmentCategory.AR
		? 'bg-blue-100 text-blue-700'
		: 'bg-violet-100 text-violet-700';
}
