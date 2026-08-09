# Optikt DB Backup

Imagen efímera que ejecuta `pg_dump` y sube el resultado comprimido a Google Drive mediante OAuth2.

Imagen pública en Docker Hub: **`optikt/optikt-backup:latest`**

> La imagen no contiene ningún secret. El token de Google Drive llega como variable de entorno en el servidor.

---

## Cómo funciona

```
Dokploy Schedule Job (cron)
        ↓  docker run --rm  (container efímero, DNS fresco en cada ejecución)
   Imagen optikt/optikt-backup
        ↓  env vars (configuradas en el Schedule Job)
  pg_dump → gzip → rclone upload a Google Drive → webhook a optikt-app
```

El container hace el backup y **sale**. No hay crond, no hay scheduler interno, no hay proceso long-running. Dokploy se encarga del cron y del historial de ejecuciones. Esto elimina el problema de DNS stale de Docker que dejaba el container sin subir backups por días.

rclone lee `RCLONE_CONFIG_GDRIVE_TOKEN` nativamente — los archivos subidos a Drive quedan bajo la cuota de tu cuenta personal, no de una service account.

---

## 1. Prerequisitos: obtener el token OAuth2

Esto se hace **una sola vez** desde una máquina con navegador.

```bash
docker run --rm -it rclone/rclone config
```

Seguí el wizard:

1. `n` → New remote
2. Name: `gdrive`
3. Storage type: `drive` (Google Drive)
4. Client ID y Client Secret: dejá vacío (Enter) para usar los de rclone
5. Scope: `drive.file` (acceso solo a archivos creados por la app)
6. Root folder ID: vacío (Enter)
7. Service Account: vacío (Enter)
8. Advanced config: `n`
9. Auto config: `y` → se abre el navegador, autorizás con tu cuenta Google
10. Shared drive: `n`
11. Confirmás con `y`

Al terminar, el token queda guardado. Para extraerlo:

```bash
docker run --rm -it rclone/rclone config show gdrive
```

Buscá la línea `token = {...}`. Ese JSON completo es el valor de `RCLONE_CONFIG_GDRIVE_TOKEN`.

---

## 2. Prerequisitos: carpeta de Google Drive

1. Creá una carpeta en tu Google Drive (ej. `optikt-backups`).
2. El **Folder ID** es el segmento al final de la URL:
   ```
   https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H  →  1A2B3C4D5E6F7G8H
   ```

---

## 3. Build y push de la imagen (desde el repo)

```bash
# Desde la raíz del repo
docker build -t optikt/optikt-backup:latest ./backup

docker push optikt/optikt-backup:latest
```

Hacé esto cada vez que modifiques algo en `backup/`. En el futuro puede automatizarse con un GitHub Actions workflow.

---

## 4. Setup en Dokploy (Schedule Job)

1. En el panel de Dokploy, ir a **Schedule Jobs** → **Create Job**
2. Tipo: **Application**
3. Imagen: `optikt/optikt-backup:latest`
4. Schedule: `0 2 * * *` (todos los días a las 2:00 AM, hora local del servidor)
5. Network: asegurate de que pueda alcanzar el contenedor de PostgreSQL (misma network/docker network que la BD) y el webhook de optikt-app.

### Environment variables

| Variable                     | Valor                                                |
| ---------------------------- | ---------------------------------------------------- |
| `PG_HOST`                    | nombre del contenedor de la BD (ej. `postgres`)      |
| `PG_PORT`                    | `5432`                                               |
| `PG_USER`                    | `optikt`                                             |
| `PG_PASSWORD`                | valor de `DB_PASSWORD`                               |
| `PG_DB`                      | `optikt_db`                                          |
| `DRIVE_REMOTE`               | `gdrive`                                             |
| `BACKUP_RETENTION_DAYS`      | `30`                                                 |
| `TZ`                         | `America/Caracas`                                    |
| `RCLONE_CONFIG_GDRIVE_TOKEN` | el JSON del token OAuth2                             |
| `NOTIFY_URL`                 | `http://optikt-app:3000/api/internal/backup-webhook` |
| `NOTIFY_TOKEN`               | valor de `BACKUP_NOTIFY_TOKEN`                       |

> **Importante:** el container es efímero y Dokploy no conserva el exit code como healthcheck automático, pero guarda el historial de logs de cada ejecución en **Schedule Jobs**. El webhook notifica a optikt-app el resultado (éxito/error), que es lo que alimenta la UI de Backups en la app.

### Probar

Hacé clic en **Run Now** en la UI de Dokploy. Verificá en los logs del job que el backup se ejecutó, subió a Drive y envió el webhook.

---

## 5. Trigger manual desde la app (UI de Backups)

La app (`/backups`, solo SUPERADMIN) dispara el Schedule Job manualmente vía la API de Dokploy. Configurá en el `.env` de optikt-app:

```env
# Dokploy API (para trigger manual de backups)
DOKPLOY_API_URL=https://dokploy.mi-dominio.com
DOKPLOY_API_KEY=tu_api_key
DOKPLOY_BACKUP_SCHEDULE_ID=id_del_schedule_job
```

- **API key**: generarla en Dokploy → Profile Settings → API Keys/Tokens.
- **Schedule ID**: visible en la URL al editar el Schedule Job en el panel de Dokploy.

La UI muestra el historial de backups a partir de las notificaciones `BACKUP_CREATED`/`BACKUP_FAILED` que el webhook registra en la base de datos de optikt-app.

---

## 6. Troubleshooting

### El backup no se ejecuta

- Verificá que el Schedule Job esté habilitado en Dokploy y que el cron sea correcto (`0 2 * * *`).
- Revisá los logs del job en **Schedule Jobs** → el job → **Logs**.

### Drive: `storageQuotaExceeded` / `Error 403`

Esto ocurre cuando se usan Service Accounts con Google Drive personal — las service accounts no tienen cuota de almacenamiento propia. La solución es usar OAuth2 (este approach). Verificá que `RCLONE_CONFIG_GDRIVE_TOKEN` está seteado correctamente en el Schedule Job.

### Drive: token expirado o inválido

Repetí el paso 1 (wizard de rclone) para generar un token fresco y actualizá la env var en el Schedule Job de Dokploy.

### pg_dump: `could not connect to server`

- Verificá que el Schedule Job esté en la misma network Docker que PostgreSQL.
- Probá la conexión manualmente:
  ```bash
  docker run --rm --network <network-de-dokploy> \
    -e PG_PASSWORD=... -e PG_HOST=postgres -e PG_USER=optikt -e PG_DB=optikt_db \
    optikt/optikt-backup:latest /usr/local/bin/backup.sh
  ```

### La UI de Backups muestra "Sin historial"

- Verificá que `NOTIFY_URL` y `NOTIFY_TOKEN` estén bien configurados en el Schedule Job.
- Verificá que `BACKUP_NOTIFY_TOKEN` de optikt-app coincida con el `NOTIFY_TOKEN` del job.
- Comprobá en los logs del job que el webhook respondió `{"ok":true}`.

### DNS stale (el problema que motivó este cambio)

El approach anterior usaba un container long-running con busybox crond y `docker exec` para triggers. Con el tiempo, el DNS interno de Docker (`127.0.0.11:53`) se corrompía, rclone no podía resolver `oauth2.googleapis.com` y los uploads fallaban por días sin que nadie se enterara. Con Dokploy Schedule Jobs, cada ejecución es un container fresco con DNS fresco — este problema no vuelve a ocurrir.
