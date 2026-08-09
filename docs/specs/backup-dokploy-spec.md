# Spec: backup-dokploy-spec

Scope: feature

# Backup Dokploy Migration + UI — Technical Spec

## Fase 1: Migración a Dokploy Cron

### 1.1 Dockerfile simplificado (`backup/Dockerfile`)

Cambios:

- Eliminar `entrypoint.sh` del COPY y del ENTRYPOINT
- Cambiar ENTRYPOINT por CMD que ejecuta backup.sh directamente
- bash sigue siendo necesario (backup.sh usa bash)

```dockerfile
FROM alpine:3.19

RUN apk add --no-cache \
    postgresql16-client \
    rclone \
    curl \
    bash \
    tzdata

COPY rclone.conf /etc/rclone/rclone.conf
COPY backup.sh /usr/local/bin/backup.sh

RUN chmod +x /usr/local/bin/backup.sh \
    && mkdir -p /backups /var/log /etc/rclone

CMD ["/usr/local/bin/backup.sh"]
```

### 1.2 Eliminar `backup/entrypoint.sh`

Ya no se necesita scheduler interno. Dokploy maneja el cron.

### 1.3 backup.sh — sin cambios funcionales

El script ya funciona standalone (pg_dump → gzip → rclone upload → retention → webhook → cleanup). No requiere modificaciones. El exit code ya refleja success/error para que Dokploy registre el estado del job.

### 1.4 docker-compose-prod.yml

Eliminar completamente el bloque del servicio `backup` (líneas 36-60). Ya no es un servicio long-running. Dokploy lo ejecuta como container efímero.

### 1.5 Documentación Dokploy (`backup/README.md`)

Agregar sección "Setup en Dokploy" reemplazando la sección actual de docker-compose:

```markdown
## Setup en Dokploy (Schedule Job)

1. En el panel de Dokploy, ir a **Schedule Jobs** → **Create Job**
2. Tipo: **Application** (o Compose si usas compose)
3. Imagen: `optikt/optikt-backup:latest`
4. Schedule: `0 2 * * *` (todos los días a las 2:00 AM)
5. Environment variables — mismas que antes:

| Variable                   | Valor                                              |
| -------------------------- | -------------------------------------------------- |
| PG_HOST                    | postgres (o nombre del contenedor de BD)           |
| PG_PORT                    | 5432                                               |
| PG_USER                    | optikt                                             |
| PG_PASSWORD                | (valor de DB_PASSWORD)                             |
| PG_DB                      | optikt_db                                          |
| DRIVE_REMOTE               | gdrive                                             |
| BACKUP_RETENTION_DAYS      | 30                                                 |
| TZ                         | America/Caracas                                    |
| RCLONE_CONFIG_GDRIVE_TOKEN | (token JSON de rclone)                             |
| NOTIFY_URL                 | http://optikt-app:3000/api/internal/backup-webhook |
| NOTIFY_TOKEN               | (valor de BACKUP_NOTIFY_TOKEN)                     |

6. Guardar. Dokploy ejecutará automáticamente según el cron.
7. Para probar: hacer clic en **Run Now** en la UI de Dokploy.

### Trigger manual desde la app

La app usa la API de Dokploy para disparar el job manualmente.
Configurar en `.env`:

- `DOKPLOY_API_URL` — URL base de Dokploy (ej. https://dokploy.mi-dominio.com)
- `DOKPLOY_API_KEY` — API key generada en Profile Settings
- `DOKPLOY_BACKUP_SCHEDULE_ID` — ID del schedule job (visible en la URL al editar)
```

---

## Fase 2: Backup UI

### 2.1 Nuevo tipo de notificación: BACKUP_FAILED

**Archivo:** `src/lib/shared/enums/notificationTypes.ts`

Agregar al enum:

```ts
BACKUP_FAILED = 'BACKUP_FAILED';
```

### 2.2 Webhook actualizado

**Archivo:** `src/routes/api/internal/backup-webhook/+server.ts`

Cambios:

- Leer `status` del body (además de `filename`, `size`, `timestamp`)
- Si `status === "error"`, crear notificación `BACKUP_FAILED` en vez de `BACKUP_CREATED`
- Guardar `size` y `timestamp` en metadata para ambos casos

Nuevo handler:

```ts
import { notifyBackupCreated, notifyBackupFailed } from '$lib/server/notifications/service';

// ... auth checks igual que antes ...

const status = body.status || 'success';

if (status === 'error') {
	await notifyBackupFailed({
		fileName: body.filename,
		error: body.error || 'Error desconocido',
		timestamp: body.timestamp
	});
} else {
	await notifyBackupCreated({
		fileName: body.filename,
		sizeBytes: body.size ? parseSize(body.size) : undefined,
		timestamp: body.timestamp
	});
}
```

### 2.3 Nuevas funciones de notificación

**Archivo:** `src/lib/server/notifications/service.ts`

Agregar `notifyBackupFailed`:

```ts
export async function notifyBackupFailed(input: {
	fileName: string;
	error: string;
	timestamp?: string;
	executor?: DbOrTx;
}) {
	return publishNotification(
		{
			type: NotificationType.BACKUP_FAILED,
			severity: NotificationSeverity.ERROR,
			title: 'Backup de base de datos fallido',
			body: `El backup ${input.fileName} falló: ${input.error}.`,
			metadata: {
				fileName: input.fileName,
				error: input.error,
				timestamp: input.timestamp ?? null
			},
			targetRoles: [UserRole.ADMIN]
		},
		input.executor
	);
}
```

Actualizar `notifyBackupCreated` para aceptar `timestamp` en metadata.

### 2.4 Query: historial de backups

**Archivo:** `src/lib/server/db/queries/notifications.ts` (o nuevo archivo `src/lib/server/db/queries/backupHistory.ts`)

Nueva función:

```ts
export async function getRecentBackupNotifications(limit = 50, executor?: DbOrTx) {
	const db = executor ?? db;
	return db.query.notifications.findMany({
		where: (n, { inArray }) =>
			inArray(n.type, [NotificationType.BACKUP_CREATED, NotificationType.BACKUP_FAILED]),
		orderBy: (n, { desc }) => desc(n.createdAt),
		limit
	});
}
```

### 2.5 Remote functions

**Archivo:** `src/lib/remote/backups.remote.ts` (nuevo)

```ts
import { command } from '$lib/remote';
import { z } from 'zod';
import { requireUserAdmin } from '$lib/server/guards';
import { getRecentBackupNotifications } from '$lib/server/db/queries/notifications';
import { env } from '$env/dynamic/private';

// Schemas
const ListBackupHistorySchema = z.object({
	limit: z.number().min(1).max(100).optional().default(50)
});

const RunBackupSchema = z.object({});

const GetBackupStatusSchema = z.object({});

// Handlers
export const listBackupHistory = command(ListBackupHistorySchema, async (input, ctx) => {
	requireUserAdmin(ctx.user);
	const notifications = await getRecentBackupNotifications(input.limit);
	return notifications.map((n) => ({
		id: n.id,
		type: n.type,
		fileName: (n.metadata as any)?.fileName ?? 'Desconocido',
		size: (n.metadata as any)?.sizeBytes ?? null,
		timestamp: n.createdAt,
		status: n.type === 'BACKUP_CREATED' ? 'success' : 'error',
		error: (n.metadata as any)?.error ?? null
	}));
});

export const runBackup = command(RunBackupSchema, async (_input, ctx) => {
	requireUserAdmin(ctx.user);

	const apiUrl = env.DOKPLOY_API_URL;
	const apiKey = env.DOKPLOY_API_KEY;
	const scheduleId = env.DOKPLOY_BACKUP_SCHEDULE_ID;

	if (!apiUrl || !apiKey || !scheduleId) {
		throw new Error(
			'Dokploy API no configurada. Configurar DOKPLOY_API_URL, DOKPLOY_API_KEY y DOKPLOY_BACKUP_SCHEDULE_ID.'
		);
	}

	const response = await fetch(`${apiUrl}/api/schedule/trigger`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey
		},
		body: JSON.stringify({ scheduleId })
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Dokploy API respondió con error (${response.status}): ${text}`);
	}

	return { success: true, message: 'Backup iniciado. Recibirá una notificación al completar.' };
});

export const getBackupStatus = command(GetBackupStatusSchema, async (_input, ctx) => {
	requireUserAdmin(ctx.user);

	const [latest] = await getRecentBackupNotifications(1);

	if (!latest) {
		return {
			status: 'unknown',
			label: 'Sin historial de backups',
			lastBackupAt: null,
			lastBackupFile: null,
			isHealthy: false
		};
	}

	const hoursSinceLastBackup =
		(Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
	const isSuccess = latest.type === 'BACKUP_CREATED';

	let status: 'healthy' | 'stale' | 'failing';
	let label: string;
	let isHealthy: boolean;

	if (isSuccess && hoursSinceLastBackup < 26) {
		status = 'healthy';
		label = 'Backups funcionando correctamente';
		isHealthy = true;
	} else if (isSuccess && hoursSinceLastBackup < 50) {
		status = 'stale';
		label = 'Último backup tiene más de 24 horas';
		isHealthy = false;
	} else {
		status = 'failing';
		label = isSuccess
			? `Sin backups en ${Math.round(hoursSinceLastBackup)} horas`
			: 'Último backup falló';
		isHealthy = false;
	}

	return {
		status,
		label,
		lastBackupAt: latest.createdAt,
		lastBackupFile: (latest.metadata as any)?.fileName ?? null,
		lastBackupStatus: isSuccess ? 'success' : 'error',
		hoursSinceLastBackup: Math.round(hoursSinceLastBackup),
		isHealthy
	};
});
```

### 2.6 Página /backups

**Archivo:** `src/routes/(app)/backups/+page.server.ts` (nuevo)

```ts
import { requireUserAdmin } from '$lib/server/guards';
import { listBackupHistory } from '$lib/remote/backups.remote';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Initial data via server load (optional — can also fetch client-side)
	return {};
};
```

La página usa `listBackupHistory` y `getBackupStatus` vía `useCommand()` en el frontend (Svelte 5 runes).

**Archivo:** `src/routes/(app)/backups/+page.svelte` (nuevo)

Layout:

```
┌────────────────────────────────────────────┐
│  Backups de base de datos                  │
│  🟢 Backups OK · Último: hoy 02:00 AM      │
│                                             │
│  [🔄 Ejecutar backup ahora]  [🔄 Refresh]   │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ Archivo          │ Tamaño │ Fecha    │  │
│  │ optikt-backup... │ 448 KB │ 09 ago   │  │
│  │ optikt-backup... │ 448 KB │ 08 ago   │  │
│  │ optikt-backup... │ FAIL   │ 07 ago   │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

Estados:

- **Loading**: skeleton/spinner en tabla
- **Error**: toast + mensaje inline
- **Empty**: "No hay historial de backups. Configurá el Schedule Job en Dokploy."
- **Running**: botón disabled con spinner, texto "Ejecutando backup..."
- **Data**: tabla con paginación (10 por página)

### 2.7 Componentes

**`BackupsStatusBadge.svelte`** — Badge de estado general:

```svelte
<script lang="ts">
	interface Props {
		status: 'healthy' | 'stale' | 'failing' | 'unknown';
		label: string;
		lastBackupAt: string | null;
	}
	let { status, label, lastBackupAt }: Props = $props();
</script>

<div class="flex items-center gap-2">
	{#if status === 'healthy'}
		<span class="h-2 w-2 rounded-full bg-green-500" />
	{:else if status === 'stale'}
		<span class="h-2 w-2 rounded-full bg-yellow-500" />
	{:else if status === 'failing'}
		<span class="h-2 w-2 rounded-full bg-red-500" />
	{:else}
		<span class="h-2 w-2 rounded-full bg-gray-400" />
	{/if}
	<span class="text-sm">{label}</span>
	{#if lastBackupAt}
		<span class="text-xs text-outline">
			· Último: {new Date(lastBackupAt).toLocaleString('es-VE')}
		</span>
	{/if}
</div>
```

**`BackupsTable.svelte`** — Tabla de historial usando DataTable existente.

### 2.8 Sidebar

**Archivo:** `src/lib/shared/routes.ts`

Agregar a `SUPER_ADMIN_ITEMS`:

```ts
{ href: '/backups', label: 'Backups', icon: 'hard-drive' }
```

Verificar que el icono `hard-drive` existe en el mapeo de iconos de la sidebar.

### 2.9 Env vars

**Archivo:** `.env.example`

Agregar:

```env
# Dokploy API (para trigger manual de backups)
DOKPLOY_API_URL=
DOKPLOY_API_KEY=
DOKPLOY_BACKUP_SCHEDULE_ID=
```

---

## Lo que NO se necesita (eliminado del diseño anterior)

| Componente                      | Motivo                                                   |
| ------------------------------- | -------------------------------------------------------- |
| docker-socket-proxy             | No se usa Docker API. El trigger va por Dokploy API.     |
| HEALTHCHECK en Dockerfile       | Container efímero — Dokploy maneja health vía exit code. |
| `/tmp/backup-last-run`          | No hay container long-running que monitorear.            |
| rclone en optikt-app            | No se lista GDrive directo. Se usa tabla notifications.  |
| Google Drive API / `googleapis` | No se consulta GDrive. El webhook registra todo en DB.   |
| docker exec / Docker API calls  | Reemplazado por Dokploy API.                             |

---

## Plan de verificación

1. `pnpm check` — 0 type errors
2. `pnpm lint` — 0 warnings
3. Build y push de nueva imagen backup
4. Configurar Schedule Job en Dokploy con cron de prueba (cada 5 min)
5. Verificar que el backup se ejecuta, sube a GDrive y la notificación llega
6. Configurar env vars de Dokploy API en optikt-app
7. Probar trigger manual desde UI: botón → Dokploy ejecuta → webhook → UI refleja
8. Simular fallo (DNS down, credenciales inválidas) → verificar BACKUP_FAILED en UI
9. Probar estado stale (no backups en >26h): cambiar cron a futuro y verificar badge amarillo
