import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { desc, eq, inArray } from 'drizzle-orm';
import type { SupportTicket } from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { notifications, supportTickets, users } from '$lib/server/db/schema';
import { callRemote } from '$lib/testing/remoteHarness';
import type {
	SupportTicketActivityRow,
	SupportTicketRow
} from '$lib/server/db/queries/supportTickets';
import type { PaginatedResult } from '$lib/types';
import {
	NotificationType,
	TicketActivityKind,
	TicketCategory,
	TicketPriority,
	TicketRelatedType,
	TicketStatus,
	UserRole
} from '$lib/shared/enums';
import {
	addSupportTicketCommentCommand,
	countOpenSupportTicketsQuery,
	createSupportTicketCommand,
	getSupportTicketQuery,
	listSupportTicketActivityQuery,
	listSupportTicketsQuery,
	updateSupportTicketCommand
} from './supportTickets.remote';

const suffix = crypto.randomUUID().slice(0, 8);

function testUser(role: UserRole, label: string) {
	return {
		id: crypto.randomUUID(),
		role,
		email: `${label}-${suffix}@test.local`,
		username: `${label}_${suffix}`,
		fullName: `${label} test`,
		hashedPassword: 'test-hash'
	};
}

const admin = testUser(UserRole.ADMIN, 'admin');
const seller = testUser(UserRole.SELLER, 'seller');
const otherSeller = testUser(UserRole.SELLER, 'other');

const createdTicketIds: string[] = [];
const createdTicketLinks: string[] = [];

function asTicket(value: unknown): SupportTicket {
	return value as SupportTicket;
}

beforeAll(async () => {
	await db.insert(users).values([admin, seller, otherSeller]);
});

afterAll(async () => {
	if (createdTicketIds.length > 0) {
		await db.delete(supportTickets).where(inArray(supportTickets.id, createdTicketIds));
	}
	if (createdTicketLinks.length > 0) {
		await db.delete(notifications).where(inArray(notifications.link, createdTicketLinks));
	}
	await db.delete(users).where(inArray(users.id, [admin.id, seller.id, otherSeller.id]));
});

async function createTicket(overrides: Record<string, unknown> = {}) {
	const ticket = asTicket(
		await callRemote(
			createSupportTicketCommand,
			{
				title: 'No guarda ventas',
				description: 'Al confirmar la venta se queda cargando',
				category: TicketCategory.BUG,
				priority: TicketPriority.HIGH,
				relatedType: TicketRelatedType.REPORTS,
				relatedLabel: 'Reportes de caja',
				...overrides
			},
			{ user: seller }
		)
	);
	createdTicketIds.push(ticket.id);
	createdTicketLinks.push(`/support/${ticket.id}`);
	return ticket;
}

describe('support ticket remotes', () => {
	it('rejects unauthenticated access on every remote', async () => {
		const id = crypto.randomUUID();

		await expect(
			callRemote(listSupportTicketsQuery, { page: 1, perPage: 10 }, { user: null })
		).rejects.toMatchObject({ status: 401 });
		await expect(
			callRemote(countOpenSupportTicketsQuery, undefined, { user: null })
		).rejects.toMatchObject({ status: 401 });
		await expect(callRemote(getSupportTicketQuery, { id }, { user: null })).rejects.toMatchObject({
			status: 401
		});
		await expect(
			callRemote(listSupportTicketActivityQuery, { id }, { user: null })
		).rejects.toMatchObject({ status: 401 });
		await expect(
			callRemote(
				createSupportTicketCommand,
				{
					title: 'Ticket sin sesión',
					description: 'No debería poder crearse',
					category: TicketCategory.BUG,
					priority: TicketPriority.LOW
				},
				{ user: null }
			)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			callRemote(
				addSupportTicketCommentCommand,
				{ ticketId: id, body: 'sin sesión' },
				{ user: null }
			)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			callRemote(
				updateSupportTicketCommand,
				{ id, status: TicketStatus.IN_PROGRESS, priority: TicketPriority.LOW },
				{ user: null }
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('creates a ticket and notifies admins and managers', async () => {
		const ticket = await createTicket();

		expect(ticket.number).toBeGreaterThan(0);
		expect(ticket.status).toBe(TicketStatus.OPEN);
		expect(ticket.createdById).toBe(seller.id);
		expect(ticket.relatedLabel).toBe('Reportes de caja');

		const [notification] = await db
			.select()
			.from(notifications)
			.where(eq(notifications.type, NotificationType.SUPPORT_TICKET_CREATED))
			.orderBy(desc(notifications.createdAt))
			.limit(1);

		expect(notification?.link).toBe(`/support/${ticket.id}`);
		expect(notification?.metadata).toMatchObject({ ticketId: ticket.id, number: ticket.number });
		expect(notification?.targetRoles).toEqual([UserRole.ADMIN, UserRole.MANAGER]);
	});

	it('lists tickets respecting visibility and filters', async () => {
		const ticket = await createTicket({ title: 'Inconsistencia en caja' });
		const otherTicket = await createTicket({
			title: 'Error de lente',
			category: TicketCategory.INCONSISTENCY,
			priority: TicketPriority.LOW
		});

		const adminList = (await callRemote(
			listSupportTicketsQuery,
			{ page: 1, perPage: 50 },
			{ user: admin }
		)) as PaginatedResult<SupportTicketRow>;
		expect(adminList.items.map((row) => row.id)).toEqual(
			expect.arrayContaining([ticket.id, otherTicket.id])
		);
		expect(adminList.items.some((row) => row.createdByUsername === seller.username)).toBe(true);

		const sellerList = (await callRemote(
			listSupportTicketsQuery,
			{ page: 1, perPage: 50 },
			{ user: seller }
		)) as PaginatedResult<SupportTicketRow>;
		expect(sellerList.items.every((row) => row.createdById === seller.id)).toBe(true);

		const otherList = (await callRemote(
			listSupportTicketsQuery,
			{ page: 1, perPage: 50 },
			{ user: otherSeller }
		)) as PaginatedResult<SupportTicketRow>;
		expect(otherList.items).toHaveLength(0);

		const byNumber = (await callRemote(
			listSupportTicketsQuery,
			{ page: 1, perPage: 10, search: String(ticket.number) },
			{ user: admin }
		)) as PaginatedResult<SupportTicketRow>;
		expect(byNumber.items.map((row) => row.id)).toContain(ticket.id);

		const byCategory = (await callRemote(
			listSupportTicketsQuery,
			{ page: 1, perPage: 10, category: TicketCategory.INCONSISTENCY },
			{ user: admin }
		)) as PaginatedResult<SupportTicketRow>;
		expect(byCategory.items.map((row) => row.id)).toContain(otherTicket.id);

		const byPriority = (await callRemote(
			listSupportTicketsQuery,
			{ page: 1, perPage: 10, priority: TicketPriority.HIGH },
			{ user: admin }
		)) as PaginatedResult<SupportTicketRow>;
		expect(byPriority.items.some((row) => row.id === ticket.id)).toBe(true);
	});

	it('restricts ticket detail and activity to the reporter or managers', async () => {
		const ticket = await createTicket();

		const detail = (await callRemote(
			getSupportTicketQuery,
			{ id: ticket.id },
			{ user: seller }
		)) as SupportTicketRow | undefined;
		expect(detail?.id).toBe(ticket.id);

		await expect(
			callRemote(getSupportTicketQuery, { id: ticket.id }, { user: otherSeller })
		).rejects.toMatchObject({ status: 403 });
		await expect(
			callRemote(listSupportTicketActivityQuery, { id: ticket.id }, { user: otherSeller })
		).rejects.toMatchObject({ status: 403 });
		await expect(
			callRemote(getSupportTicketQuery, { id: crypto.randomUUID() }, { user: admin })
		).rejects.toMatchObject({ status: 404 });
		await expect(
			callRemote(listSupportTicketActivityQuery, { id: crypto.randomUUID() }, { user: admin })
		).rejects.toMatchObject({ status: 404 });
	});

	it('records comments and status changes in the ticket history', async () => {
		const ticket = await createTicket();

		const empty = (await callRemote(
			listSupportTicketActivityQuery,
			{ id: ticket.id },
			{ user: seller }
		)) as SupportTicketActivityRow[];
		expect(empty).toHaveLength(0);

		await callRemote(
			addSupportTicketCommentCommand,
			{ ticketId: ticket.id, body: 'Me pasó dos veces' },
			{ user: seller }
		);

		const afterComment = (await callRemote(
			listSupportTicketActivityQuery,
			{ id: ticket.id },
			{ user: admin }
		)) as SupportTicketActivityRow[];
		expect(afterComment).toHaveLength(1);
		expect(afterComment[0]).toMatchObject({
			kind: TicketActivityKind.COMMENT,
			body: 'Me pasó dos veces',
			authorId: seller.id,
			metadata: null
		});

		const updated = asTicket(
			await callRemote(
				updateSupportTicketCommand,
				{
					id: ticket.id,
					status: TicketStatus.IN_PROGRESS,
					priority: TicketPriority.MEDIUM,
					comment: 'En revisión'
				},
				{ user: admin }
			)
		);
		expect(updated.status).toBe(TicketStatus.IN_PROGRESS);
		expect(updated.priority).toBe(TicketPriority.MEDIUM);

		const afterChange = (await callRemote(
			listSupportTicketActivityQuery,
			{ id: ticket.id },
			{ user: admin }
		)) as SupportTicketActivityRow[];
		const change = afterChange.find((entry) => entry.kind === TicketActivityKind.CHANGE);
		expect(change).toMatchObject({
			body: 'En revisión',
			authorId: admin.id,
			metadata: {
				statusFrom: TicketStatus.OPEN,
				statusTo: TicketStatus.IN_PROGRESS,
				priorityFrom: TicketPriority.HIGH,
				priorityTo: TicketPriority.MEDIUM
			}
		});

		await expect(
			callRemote(
				updateSupportTicketCommand,
				{ id: ticket.id, status: TicketStatus.RESOLVED, priority: TicketPriority.LOW },
				{ user: seller }
			)
		).rejects.toMatchObject({ status: 403 });

		const resolved = asTicket(
			await callRemote(
				updateSupportTicketCommand,
				{ id: ticket.id, status: TicketStatus.RESOLVED, priority: TicketPriority.MEDIUM },
				{ user: admin }
			)
		);
		expect(resolved.resolvedAt).not.toBeNull();
		expect(resolved.resolvedById).toBe(admin.id);

		const reopened = asTicket(
			await callRemote(
				updateSupportTicketCommand,
				{ id: ticket.id, status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM },
				{ user: admin }
			)
		);
		expect(reopened.resolvedAt).toBeNull();

		await callRemote(
			updateSupportTicketCommand,
			{
				id: ticket.id,
				status: TicketStatus.OPEN,
				priority: TicketPriority.MEDIUM,
				comment: 'Sin cambios de estado'
			},
			{ user: admin }
		);

		const afterCommentOnly = (await callRemote(
			listSupportTicketActivityQuery,
			{ id: ticket.id },
			{ user: admin }
		)) as SupportTicketActivityRow[];
		const commentOnly = afterCommentOnly.at(-1);
		expect(commentOnly).toMatchObject({
			kind: TicketActivityKind.COMMENT,
			body: 'Sin cambios de estado'
		});

		await expect(
			callRemote(
				addSupportTicketCommentCommand,
				{ ticketId: crypto.randomUUID(), body: 'fantasma' },
				{ user: admin }
			)
		).rejects.toMatchObject({ status: 404 });
		await expect(
			callRemote(
				addSupportTicketCommentCommand,
				{ ticketId: ticket.id, body: 'no autorizado' },
				{ user: otherSeller }
			)
		).rejects.toMatchObject({ status: 403 });
	});

	it('counts open tickets only for managers', async () => {
		await createTicket();

		const sellerCount = await callRemote(countOpenSupportTicketsQuery, undefined, {
			user: seller
		});
		expect(sellerCount).toBe(0);

		const adminCount = await callRemote(countOpenSupportTicketsQuery, undefined, { user: admin });
		expect(adminCount).toBeGreaterThan(0);
	});
});
