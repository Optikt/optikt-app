/**
 * Customer gender enum
 * OTRO = cuando no está definido masculino ni femenino.
 */

export enum CustomerGender {
	MASCULINO = 'MASCULINO',
	FEMENINO = 'FEMENINO',
	OTRO = 'OTRO'
}

export const ALL_CUSTOMER_GENDERS = Object.values(CustomerGender) as CustomerGender[];

/** Labels for display in Spanish */
export const CUSTOMER_GENDER_LABELS: Record<CustomerGender, string> = {
	[CustomerGender.MASCULINO]: 'Masculino',
	[CustomerGender.FEMENINO]: 'Femenino',
	[CustomerGender.OTRO]: 'Otro'
};
