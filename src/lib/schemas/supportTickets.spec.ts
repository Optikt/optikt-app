import { describe, it, expect } from 'vitest';
import {
	AddSupportTicketCommentSchema,
	CreateSupportTicketSchema,
	ListSupportTicketsSchema,
	UpdateSupportTicketSchema
} from './supportTickets';

const validTicket = {
	title: 'Error al guardar venta',
	description: 'Al confirmar la venta aparece un error 500 y no se guarda.',
	category: 'BUG',
	priority: 'HIGH'
};

describe('CreateSupportTicketSchema', () => {
	it('accepts a valid ticket', () => {
		const result = CreateSupportTicketSchema.safeParse(validTicket);
		expect(result.success).toBe(true);
	});

	it('defaults priority to MEDIUM', () => {
		const result = CreateSupportTicketSchema.safeParse({ ...validTicket, priority: undefined });
		expect(result.success).toBe(true);
		expect(result.success && result.data.priority).toBe('MEDIUM');
	});

	it('rejects short description', () => {
		const result = CreateSupportTicketSchema.safeParse({ ...validTicket, description: 'corta' });
		expect(result.success).toBe(false);
	});

	it('rejects unknown category', () => {
		const result = CreateSupportTicketSchema.safeParse({ ...validTicket, category: 'NOPE' });
		expect(result.success).toBe(false);
	});

	it('trims title and description', () => {
		const result = CreateSupportTicketSchema.safeParse({
			...validTicket,
			title: '  Error al guardar venta  ',
			description: '  Al confirmar la venta aparece un error 500 y no se guarda.  '
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.title).toBe('Error al guardar venta');
	});
});

describe('UpdateSupportTicketSchema', () => {
	it('rejects invalid status', () => {
		const result = UpdateSupportTicketSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			status: 'CLOSED',
			priority: 'LOW'
		});
		expect(result.success).toBe(false);
	});

	it('accepts a status change', () => {
		const result = UpdateSupportTicketSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			status: 'IN_PROGRESS',
			priority: 'URGENT'
		});
		expect(result.success).toBe(true);
	});

	it('accepts an optional change comment', () => {
		const result = UpdateSupportTicketSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			status: 'RESOLVED',
			priority: 'LOW',
			comment: 'Reproducido y corregido'
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.comment).toBe('Reproducido y corregido');
	});

	it('normalizes an empty comment to undefined', () => {
		const result = UpdateSupportTicketSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000000',
			status: 'RESOLVED',
			priority: 'LOW',
			comment: '   '
		});
		expect(result.success).toBe(true);
		expect(result.success && result.data.comment).toBeUndefined();
	});
});

describe('AddSupportTicketCommentSchema', () => {
	it('rejects empty body', () => {
		const result = AddSupportTicketCommentSchema.safeParse({
			ticketId: '00000000-0000-4000-8000-000000000000',
			body: '   '
		});
		expect(result.success).toBe(false);
	});
});

describe('ListSupportTicketsSchema', () => {
	it('applies pagination defaults', () => {
		const result = ListSupportTicketsSchema.safeParse({});
		expect(result.success).toBe(true);
		expect(result.success && result.data.page).toBe(1);
		expect(result.success && result.data.perPage).toBe(10);
	});
});
