export interface PendingEntity {
	pendingId: string;
	name: string;
}

export interface SelectOption {
	value: string;
	label: string;
}

export function createPendingEntity(name: string): PendingEntity {
	return {
		pendingId: `pending_${crypto.randomUUID()}`,
		name: name.trim()
	};
}

export function handleCreatePending(
	pendingList: PendingEntity[],
	name: string
): { updatedList: PendingEntity[]; option: SelectOption } {
	const entity = createPendingEntity(name);
	return {
		updatedList: [...pendingList, entity],
		option: { value: entity.pendingId, label: entity.name }
	};
}

export function getPendingName(
	pendingId: string,
	pendingSuppliers: PendingEntity[],
	pendingMaterials: PendingEntity[],
	pendingTechnologies: PendingEntity[]
): string | null {
	const sup = pendingSuppliers.find((s) => s.pendingId === pendingId);
	if (sup) return sup.name;
	const mat = pendingMaterials.find((m) => m.pendingId === pendingId);
	if (mat) return mat.name;
	const tech = pendingTechnologies.find((t) => t.pendingId === pendingId);
	if (tech) return tech.name;
	return null;
}

export function isPendingId(id: string): boolean {
	return id.startsWith('pending_');
}

export function resolvePendingId(
	formValue: string,
	pendingList: PendingEntity[]
): string | undefined {
	if (!formValue) return undefined;
	if (!isPendingId(formValue)) return undefined;
	return formValue;
}
