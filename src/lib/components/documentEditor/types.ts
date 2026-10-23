/**
 * Shared contract for the commercial-document editor (sales, quotes).
 *
 * These types are domain-agnostic. Sales and quotes adapt their own payloads
 * to them so the editor shell and the lens editor can be reused without
 * leaking `sale` / `quote` conditionals into the UI.
 */

/**
 * Domain switches consumed by the editor shell.
 * Sales enable inventory and require a change reason.
 */
export interface DocumentCapabilities {
	inventory: boolean;
	requiredReason: boolean;
}

export const SALE_CAPABILITIES: DocumentCapabilities = {
	inventory: true,
	requiredReason: true
};

export interface LensEditorEyeDraft {
	enabled: boolean;
	sphere: number | null;
	cylinder: number | null;
	axis: number | null;
	addition: number | null;
	altura: number | null;
}

export interface LensEditorTreatment {
	supplierTreatmentId: string;
	name: string;
	price: number;
	salePrice: number;
	isTaxable: boolean;
	category: string;
}

export interface LensEditorDraft {
	lensCatalogItemId: string;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: string;
	od: LensEditorEyeDraft;
	oi: LensEditorEyeDraft;
	treatments: LensEditorTreatment[];
}

export interface LensEditorFieldErrors {
	prescription?: string;
	lensCatalogItemId?: string;
	unitPrice?: string;
	quantity?: string;
	discount?: string;
	odSphere?: string;
	odCylinder?: string;
	odAxis?: string;
	odAddition?: string;
	odAltura?: string;
	osSphere?: string;
	osCylinder?: string;
	osAxis?: string;
	osAddition?: string;
	osAltura?: string;
}
