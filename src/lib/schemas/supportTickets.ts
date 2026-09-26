/**
 * Support ticket validation schemas
 */
import { z } from 'zod';
import { TicketCategory, TicketPriority, TicketRelatedType, TicketStatus } from '$lib/shared/enums';
import { EntityIdSchema } from './common/identity';
import { ListPaginationSchema } from './common/pagination';

export const ListSupportTicketsSchema = ListPaginationSchema.extend({
	status: z.enum(TicketStatus).optional(),
	category: z.enum(TicketCategory).optional(),
	priority: z.enum(TicketPriority).optional()
});

export const CreateSupportTicketSchema = z.object({
	title: z.string().trim().min(3, 'Título muy corto').max(120, 'Máximo 120 caracteres'),
	description: z
		.string()
		.trim()
		.min(10, 'Describe el problema con al menos 10 caracteres')
		.max(4000, 'Máximo 4000 caracteres'),
	category: z.enum(TicketCategory),
	priority: z.enum(TicketPriority).default(TicketPriority.MEDIUM),
	relatedType: z.enum(TicketRelatedType).optional(),
	relatedLabel: z.string().trim().max(120, 'Máximo 120 caracteres').optional()
});

export const UpdateSupportTicketSchema = z.object({
	id: z.uuid('Ticket inválido'),
	status: z.enum(TicketStatus),
	priority: z.enum(TicketPriority),
	comment: z
		.string()
		.trim()
		.max(2000, 'Máximo 2000 caracteres')
		.optional()
		.transform((value) => value || undefined)
});

export const AddSupportTicketCommentSchema = z.object({
	ticketId: z.uuid('Ticket inválido'),
	body: z.string().trim().min(1, 'Escribe un comentario').max(2000, 'Máximo 2000 caracteres')
});

export const SupportTicketIdSchema = EntityIdSchema('Ticket');
