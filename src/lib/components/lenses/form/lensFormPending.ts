export interface PendingEntity {
	pendingId: string;
	name: string;
	[key: string]: unknown;
}

export function createPendingEntity(name: string, prefix: string = 'pending'): PendingEntity {
	return {
		pendingId: `${prefix}_${crypto.randomUUID()}`,
		name: name.trim()
	};
}

export function handleCreatePending(
	pendingList: PendingEntity[],
	name: string,
	prefix: string = 'pending'
): { updatedList: PendingEntity[]; option: { id: string; name: string; isPending: boolean } } {
	const entity = createPendingEntity(name, prefix);
	return {
		updatedList: [...pendingList, entity],
		option: { id: entity.pendingId, name: entity.name, isPending: true }
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
