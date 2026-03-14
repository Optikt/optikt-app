import {
	FulfillmentPlanningStatus,
	FulfillmentSource,
	FulfillmentWarningCode,
	SurplusUnitStatus
} from './fulfillment';

export interface DomainStatusUiDescriptor {
	label: string;
	tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
	description: string;
}

export const FULFILLMENT_STATUS_UI: Record<
	FulfillmentPlanningStatus,
	DomainStatusUiDescriptor
> = {
	[FulfillmentPlanningStatus.READY]: {
		label: 'Listo',
		tone: 'success',
		description: 'El plan esta listo para ejecutarse sin pasos manuales pendientes.'
	},
	[FulfillmentPlanningStatus.REQUIRES_CONFIRMATION]: {
		label: 'Requiere confirmacion',
		tone: 'warning',
		description: 'Hay decisiones operativas que el usuario debe confirmar antes de continuar.'
	},
	[FulfillmentPlanningStatus.BLOCKED]: {
		label: 'Bloqueado',
		tone: 'danger',
		description: 'El plan no puede ejecutarse porque falta una condicion obligatoria.'
	}
};

export const FULFILLMENT_SOURCE_UI: Record<FulfillmentSource, DomainStatusUiDescriptor> = {
	[FulfillmentSource.CATALOG_STOCK]: {
		label: 'Stock de catalogo',
		tone: 'success',
		description: 'La unidad saldra del stock registrado del item de catalogo.'
	},
	[FulfillmentSource.SURPLUS_STOCK]: {
		label: 'Excedente',
		tone: 'info',
		description: 'La unidad se cubre con un cristal fisico sobrante ya disponible.'
	},
	[FulfillmentSource.SUPPLIER_ORDER]: {
		label: 'Pedido a proveedor',
		tone: 'warning',
		description: 'La unidad debe pedirse al proveedor del cristal seleccionado.'
	},
	[FulfillmentSource.LAB_ORDER]: {
		label: 'Pedido a laboratorio',
		tone: 'warning',
		description: 'La unidad debe procesarse o pedirse como trabajo de laboratorio.'
	}
};

export const FULFILLMENT_WARNING_UI: Record<FulfillmentWarningCode, DomainStatusUiDescriptor> = {
	[FulfillmentWarningCode.LOW_STOCK]: {
		label: 'Low stock',
		tone: 'danger',
		description: 'El inventario disponible esta cerca del minimo o no alcanza con holgura.'
	},
	[FulfillmentWarningCode.CONSULT_REQUIRED]: {
		label: 'Consultar',
		tone: 'warning',
		description: 'El proveedor no publica rangos o condiciones suficientes y debe consultarse.'
	},
	[FulfillmentWarningCode.SINGLE_UNIT_REQUIRES_CONFIRMATION]: {
		label: 'Unidad requiere confirmacion',
		tone: 'warning',
		description: 'El proveedor puede vender por unidad, pero solo bajo confirmacion manual.'
	},
	[FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS]: {
		label: 'Genera excedente',
		tone: 'info',
		description: 'La compra por par dejara al menos una unidad fisica sobrante en inventario.'
	},
	[FulfillmentWarningCode.TREATMENT_NOT_AVAILABLE]: {
		label: 'Tratamiento no disponible',
		tone: 'danger',
		description: 'El item o proveedor no admite el tratamiento solicitado.'
	},
	[FulfillmentWarningCode.RANGE_NOT_PUBLISHED]: {
		label: 'Rango no publicado',
		tone: 'warning',
		description: 'La firma coincide, pero no hay rango confirmado para validar la formula.'
	}
};

export const SURPLUS_STATUS_UI: Record<SurplusUnitStatus, DomainStatusUiDescriptor> = {
	[SurplusUnitStatus.AVAILABLE]: {
		label: 'Disponible',
		tone: 'success',
		description: 'La unidad fisica puede asignarse a una nueva venta.'
	},
	[SurplusUnitStatus.RESERVED]: {
		label: 'Reservado',
		tone: 'warning',
		description: 'La unidad esta comprometida temporalmente en un plan.'
	},
	[SurplusUnitStatus.CONSUMED]: {
		label: 'Consumido',
		tone: 'neutral',
		description: 'La unidad ya fue utilizada y no puede volver a ofrecerse.'
	},
	[SurplusUnitStatus.VOID]: {
		label: 'Anulado',
		tone: 'danger',
		description: 'La unidad se invalido por ajuste, error o descarte.'
	}
};