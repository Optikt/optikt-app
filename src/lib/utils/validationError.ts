/**
 * Build a user-facing message from standard-schema validation issues.
 * Used by the `handleValidationError` server hook so remote function
 * validation failures surface a readable toast instead of "Bad request".
 */

export interface ValidationIssue {
	code?: string;
	path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
	message?: string;
	format?: string;
}

const FIELD_LABELS: Record<string, string> = {
	saleDate: 'La fecha de venta',
	date: 'La fecha',
	notes: 'Las notas',
	discount: 'El descuento',
	discountType: 'El tipo de descuento',
	reason: 'El motivo',
	customerId: 'El cliente',
	items: 'Los artículos',
	quantity: 'La cantidad',
	price: 'El precio',
	unitPrice: 'El precio unitario',
	cost: 'El costo',
	status: 'El estado',
	paymentMethod: 'El método de pago',
	amount: 'El monto',
	paidAmount: 'El monto pagado',
	total: 'El total',
	name: 'El nombre',
	description: 'La descripción',
	reference: 'La referencia',
	type: 'El tipo',
	id: 'El identificador',
	productId: 'El producto',
	lotId: 'El lote',
	brandId: 'La marca',
	supplierId: 'El proveedor',
	lensCatalogItemId: 'El lente',
	orderNumber: 'El número de orden',
	email: 'El correo electrónico',
	phone: 'El teléfono',
	idNumber: 'La cédula',
	address: 'La dirección'
};

function humanizeSegment(segment: PropertyKey): string {
	const text = String(segment)
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.toLowerCase();
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelForPath(
	path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
): string | null {
	if (!path || path.length === 0) return null;
	const raw = path[path.length - 1];
	const last = typeof raw === 'object' && raw !== null ? raw.key : raw;
	if (typeof last === 'string' && FIELD_LABELS[last]) return FIELD_LABELS[last];
	if (typeof last === 'string') return humanizeSegment(last);
	return null;
}

function phraseForIssue(issue: ValidationIssue): string | null {
	switch (issue.code) {
		case 'custom':
			return issue.message ?? null;
		case 'required':
			return 'es requerido';
		case 'invalid_type':
		case 'invalid_literal':
		case 'invalid_string':
		case 'invalid_union':
		case 'invalid_union_discriminator':
		case 'invalid_arguments':
		case 'invalid_return_type':
			return 'es inválido';
		case 'invalid_enum_value':
			return 'no es una opción válida';
		case 'invalid_format':
			switch (issue.format) {
				case 'date':
				case 'iso_date':
				case 'datetime':
					return 'no es una fecha válida';
				case 'email':
					return 'no es un correo electrónico válido';
				case 'url':
					return 'no es una URL válida';
				case 'uuid':
					return 'no es un identificador válido';
				default:
					return 'no tiene el formato esperado';
			}
		case 'too_small':
			return 'no cumple el mínimo requerido';
		case 'too_big':
			return 'excede el máximo permitido';
		case 'invalid_length':
			return 'no tiene la longitud esperada';
		case 'not_multiple_of':
			return 'no es un múltiplo válido';
		case 'unrecognized_keys':
			return 'contiene campos no permitidos';
		default:
			return null;
	}
}

export function buildValidationMessage(
	issues: ValidationIssue[],
	options: { maxIssues?: number } = {}
): string {
	const { maxIssues = 1 } = options;
	if (issues.length === 0) return 'Datos inválidos';

	const seen = new Set<string>();
	const parts: string[] = [];

	for (const issue of issues) {
		if (parts.length >= maxIssues) break;

		const isCustomMessage = issue.code === 'custom' && !!issue.message;
		let part: string;
		if (isCustomMessage) {
			part = issue.message as string;
		} else {
			const label = labelForPath(issue.path);
			part = label
				? `${label} ${phraseForIssue(issue) ?? 'es inválido'}`
				: `El valor ${phraseForIssue(issue) ?? 'es inválido'}`;
		}

		if (seen.has(part)) continue;
		seen.add(part);
		parts.push(part);
	}

	return parts.length > 0 ? parts.join('; ') : 'Datos inválidos';
}
