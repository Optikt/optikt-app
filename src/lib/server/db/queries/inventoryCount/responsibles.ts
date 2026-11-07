/**
 * Conteo Físico — responsables (usuarios y personas externas).
 * Baja lógica: quitar a alguien no borra lo que ya contó.
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { inventoryCountResponsibles, users } from '$lib/server/db/schema';
import type { ResponsibleRow, ResponsibleEntry } from './types';

/** Responsables activos de una sesión (orden de alta). */
export async function listSessionResponsibles(
	sessionId: number,
	executor: DbOrTx = db
): Promise<ResponsibleRow[]> {
	const rows = await executor
		.select({
			id: inventoryCountResponsibles.id,
			userId: inventoryCountResponsibles.userId,
			displayName: inventoryCountResponsibles.displayName,
			isExternal: inventoryCountResponsibles.isExternal,
			addedAt: inventoryCountResponsibles.addedAt
		})
		.from(inventoryCountResponsibles)
		.where(
			and(
				eq(inventoryCountResponsibles.sessionId, sessionId),
				isNull(inventoryCountResponsibles.removedAt)
			)
		)
		.orderBy(asc(inventoryCountResponsibles.addedAt));
	return rows;
}

/**
 * Sincroniza los responsables activos con la lista del panel:
 * agrega lo nuevo (resolviendo nombres de usuario en el server, jamás del cliente)
 * y da de baja (removedAt) lo que ya no figura.
 */
export async function syncSessionResponsibles(
	sessionId: number,
	entries: ResponsibleEntry[],
	addedById: string,
	executor: DbOrTx = db
): Promise<ResponsibleRow[]> {
	const current = await listSessionResponsibles(sessionId, executor);
	const now = new Date().toISOString();

	const wantedUserIds = entries
		.filter((entry) => entry.userId != null)
		.map((entry) => entry.userId as string);
	const wantedUserSet = new Set(wantedUserIds);
	const wantedExternalNames = new Set(
		entries.filter((entry) => entry.userId == null).map((entry) => entry.displayName)
	);

	// Usuarios nuevos: resolver nombre desde la tabla users.
	const haveUserIds = new Set(
		current.filter((row) => row.userId != null).map((row) => row.userId as string)
	);
	const missingUserIds = wantedUserIds.filter((userId) => !haveUserIds.has(userId));
	if (missingUserIds.length > 0) {
		const profiles = await executor
			.select({ id: users.id, fullName: users.fullName })
			.from(users)
			.where(inArray(users.id, missingUserIds));
		const nameOf = new Map(profiles.map((profile) => [profile.id, profile.fullName]));
		await executor.insert(inventoryCountResponsibles).values(
			missingUserIds.map((userId) => ({
				sessionId,
				userId,
				displayName: nameOf.get(userId) ?? 'Usuario',
				isExternal: false,
				addedById,
				addedAt: now,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	// Personas externas nuevas (nombre libre validado por Zod).
	const haveExternalNames = new Set(
		current.filter((row) => row.isExternal).map((row) => row.displayName)
	);
	const missingExternals = [...wantedExternalNames].filter(
		(displayName) => !haveExternalNames.has(displayName)
	);
	if (missingExternals.length > 0) {
		await executor.insert(inventoryCountResponsibles).values(
			missingExternals.map((displayName) => ({
				sessionId,
				userId: null,
				displayName,
				isExternal: true,
				addedById,
				addedAt: now,
				createdAt: now,
				updatedAt: now
			}))
		);
	}

	// Baja lógica de los que quedan fuera de la lista.
	for (const row of current) {
		const wanted =
			row.userId != null ? wantedUserSet.has(row.userId) : wantedExternalNames.has(row.displayName);
		if (wanted) continue;
		await executor
			.update(inventoryCountResponsibles)
			.set({ removedAt: now, updatedAt: now })
			.where(eq(inventoryCountResponsibles.id, row.id));
	}

	return listSessionResponsibles(sessionId, executor);
}

// ── Acceso ────────────────────────────────────────────────────────────────

/**
 * ¿El usuario puede escribir en la sesión? Regla: ADMIN/MANAGER siempre;
 * un usuario no-admin solo si es responsable activo. El rol ya lo valida el guard.
 */
export async function canUserParticipateOnSession(
	sessionId: number,
	userId: string,
	executor: DbOrTx = db
): Promise<boolean> {
	const [row] = await executor
		.select({ id: inventoryCountResponsibles.id })
		.from(inventoryCountResponsibles)
		.where(
			and(
				eq(inventoryCountResponsibles.sessionId, sessionId),
				eq(inventoryCountResponsibles.userId, userId),
				isNull(inventoryCountResponsibles.removedAt)
			)
		)
		.limit(1);
	return row != null;
}

/** Obliga participación activa a usuarios no admin (usada por guards de remote). */
export async function requireWriteAccess(
	sessionId: number,
	userId: string,
	isManagerRole: boolean,
	executor: DbOrTx = db
): Promise<void> {
	if (isManagerRole) return;
	const participant = await canUserParticipateOnSession(sessionId, userId, executor);
	if (!participant) {
		throw new Error('No figuras entre los responsables de este conteo: solo lectura');
	}
}

/** Opciones para el combobox de responsables (usuarios del sistema). */
export interface ResponsibleOption {
	userId: string;
	displayName: string;
}

export async function listResponsibleOptions(executor: DbOrTx = db): Promise<ResponsibleOption[]> {
	return executor
		.select({ userId: users.id, displayName: users.fullName })
		.from(users)
		.orderBy(asc(users.fullName));
}

/** Nº de históricos dados de baja (para el informe de responsables). */
export async function countRemovedResponsibles(
	sessionId: number,
	executor: DbOrTx = db
): Promise<number> {
	const [row] = await executor
		.select({ total: sql<number>`count(*)`.mapWith(Number) })
		.from(inventoryCountResponsibles)
		.where(
			and(
				eq(inventoryCountResponsibles.sessionId, sessionId),
				sql`${inventoryCountResponsibles.removedAt} is not null`
			)
		);
	return row?.total ?? 0;
}
