# Optikt DB Backup

Sidecar container que ejecuta `pg_dump` periódicamente y sube el resultado comprimido a Google Drive mediante OAuth2.

Imagen pública en Docker Hub: **`optikt/optikt-backup:latest`**

> La imagen no contiene ningún secret. El token de Google Drive llega como variable de entorno en el servidor.

---

## Cómo funciona

```
Imagen pública (Docker Hub)
        ↓  docker pull
   Servidor de producción
        ↓  env vars (.env del servidor)
  RCLONE_CONFIG_GDRIVE_TOKEN  ← token OAuth2 de tu cuenta Google personal
  PG_*, GOOGLE_DRIVE_*, BACKUP_CRON, TZ, ...
```

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

## 4. Setup en el servidor de producción

### 4.1. Configurar las variables de entorno en el `.env` del servidor

```env
# Backup
GOOGLE_DRIVE_BACKUP_FOLDER_ID=1A2B3C4D5E6F7G8H
RCLONE_CONFIG_GDRIVE_TOKEN={"access_token":"...","token_type":"Bearer","refresh_token":"1//...","expiry":"..."}
BACKUP_CRON=0 2 * * *
BACKUP_RETENTION_DAYS=30
TZ=America/Caracas
# Opcionales — webhook de notificación al completar
BACKUP_NOTIFY_URL=
BACKUP_NOTIFY_TOKEN=
```

> El `refresh_token` no expira mientras se use periódicamente. El backup diario lo mantiene activo indefinidamente.

### 4.2. Agregar el servicio al docker-compose del servidor

Si el servidor tiene su propio compose customizado, agregá este bloque:

```yaml
backup:
  image: optikt/optikt-backup:latest
  container_name: optikt-backup
  restart: unless-stopped
  depends_on:
    postgres:
      condition: service_healthy
  environment:
    BACKUP_CRON: ${BACKUP_CRON:-0 2 * * *}
    PG_HOST: postgres
    PG_PORT: "5432"
    PG_USER: optikt
    PG_PASSWORD: ${DB_PASSWORD}
    PG_DB: optikt_db
    GOOGLE_DRIVE_BACKUP_FOLDER_ID: ${GOOGLE_DRIVE_BACKUP_FOLDER_ID}
    DRIVE_REMOTE: gdrive
    BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-30}
    TZ: ${TZ:-UTC}
    RCLONE_CONFIG_GDRIVE_TOKEN: ${RCLONE_CONFIG_GDRIVE_TOKEN}
    NOTIFY_URL: ${BACKUP_NOTIFY_URL:-}
    NOTIFY_TOKEN: ${BACKUP_NOTIFY_TOKEN:-}
```

### 4.3. Levantar el servicio

```bash
docker compose pull backup
docker compose up -d backup
```

---

## 5. Operaciones del día a día

### Ejecutar un backup manual inmediato

```bash
docker compose exec backup /usr/local/bin/backup.sh
```

### Ver logs en tiempo real

```bash
docker compose logs -f backup
```

### Verificar que el cron está registrado correctamente

```bash
docker compose exec backup crontab -l
```

### Listar backups almacenados en Drive

```bash
docker compose exec backup rclone lsl gdrive: --config /etc/rclone/rclone.conf
```

---

## 6. Troubleshooting

### Drive: `storageQuotaExceeded` / `Error 403`

Esto ocurre cuando se usan Service Accounts con Google Drive personal — las service accounts no tienen cuota de almacenamiento propia. La solución es usar OAuth2 (este approach). Verificá que `RCLONE_CONFIG_GDRIVE_TOKEN` está seteado correctamente en el `.env`.

### Drive: token expirado o inválido

Repetí el paso 1 (wizard de rclone) para generar un token fresco y actualizá la env var en el servidor.

### pg_dump: `could not connect to server`

- Verificá que postgres esté healthy:
  ```bash
  docker compose ps postgres
  ```
- Probá la conexión desde dentro del container:
  ```bash
  docker compose exec backup \
    sh -c 'PGPASSWORD=$PG_PASSWORD pg_isready -h $PG_HOST -U $PG_USER -d $PG_DB'
  ```

### El cron no ejecuta el backup

- Verificá que el crontab esté escrito:
  ```bash
  docker compose exec backup crontab -l
  ```
- Revisá los logs del cron:
  ```bash
  docker compose exec backup cat /var/log/backup.log
  ```

