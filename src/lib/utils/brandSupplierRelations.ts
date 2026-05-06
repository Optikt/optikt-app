export interface RelationOption {
	id: string;
	name: string;
}

export function getAvailableRelationOptions(
	options: RelationOption[],
	relatedOptions: RelationOption[]
): RelationOption[] {
	const relatedIds = new Set(relatedOptions.map((option) => option.id));
	return options.filter((option) => !relatedIds.has(option.id));
}

export function formatRelationUnlinkBlockedMessage(productCount: number): string {
	const productLabel = productCount === 1 ? 'producto registrado' : 'productos registrados';
	return `No se puede quitar esta relacion: hay ${productCount} ${productLabel} con esta marca y este proveedor. Corrige esos productos primero.`;
}
