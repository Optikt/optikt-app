# Optikt DB Backup

Sidecar container que ejecuta `pg_dump` periódicamente y sube el resultado comprimido a Google Drive mediante una Service Account.

Imagen pública en Docker Hub: **`optikt/optikt-backup:latest`**

> La imagen no contiene ningún secret. Las credenciales llegan al container en tiempo de ejecución: el `service-account.json` se monta como volumen y el resto de configuración viene de variables de entorno.

---

## Cómo funciona

```
Imagen pública (Docker Hub)
        ↓  docker pull
   Servidor de producción
        ↓  volumen montado
  service-account.json  (solo en el servidor, nunca en la imagen)
        ↓  env vars (.env del servidor)
  PG_*, GOOGLE_DRIVE_*, BACKUP_CRON, TZ, ...
```

El `rclone.conf` que está dentro de la imagen únicamente declara el tipo de remote y el path donde espera el archivo de credenciales (`/etc/rclone/service-account.json`). Sin ese archivo montado, el container no puede autenticarse con Drive.

---

## 1. Prerequisitos: Service Account de Google

Esto se hace una sola vez.

1. Abrí [console.cloud.google.com](https://console.cloud.google.com) y seleccioná tu proyecto.
2. **APIs & Services → Enable APIs** → habilitá la **Google Drive API**.
3. **IAM & Admin → Service Accounts → Create Service Account**:
   - Nombre: `optikt-backup` (o el que prefieras)
   - No hace falta asignarle roles a nivel proyecto.
4. En la service account creada → **Keys → Add Key → JSON** → descargá el archivo.
5. **Compartir la carpeta de Drive** con el email de la service account (termina en `@...iam.gserviceaccount.com`) — permiso **Editor**.
6. El **Folder ID** es el segmento al final de la URL de la carpeta:
   ```
   https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H  →  1A2B3C4D5E6F7G8H
   ```

---

## 2. Build y push de la imagen (desde el repo)

La imagen se construye desde `backup/` y se publica manualmente. No contiene ningún secret.

```bash
# Desde la raíz del repo
docker build -t optikt/optikt-backup:latest ./backup

docker push optikt/optikt-backup:latest
```

Hacé esto cada vez que modifiques algo en `backup/`. En el futuro puede automatizarse con un GitHub Actions workflow.

---

## 3. Setup en el servidor de producción

### 3.1. Copiar el service-account.json al servidor

El archivo de credenciales nunca va al repo ni a la imagen. Se copia directamente al servidor:

```bash
scp ~/Downloads/mi-service-account-key.json user@servidor:/ruta/al/proyecto/backup/service-account.json
```

> El `.gitignore` del repo ya excluye `backup/service-account.json`.

### 3.2. Configurar las variables de entorno en el `.env` del servidor

```env
# Backup
GOOGLE_DRIVE_BACKUP_FOLDER_ID=1A2B3C4D5E6F7G8H
BACKUP_CRON=0 2 * * *
BACKUP_RETENTION_DAYS=30
TZ=America/Caracas
# Opcionales — webhook de notificación al completar
BACKUP_NOTIFY_URL=
BACKUP_NOTIFY_TOKEN=
```

### 3.3. Agregar el servicio al docker-compose del servidor

El `docker-compose-prod.yml` de este repo ya incluye el servicio `backup`. Si el servidor tiene su propio compose customizado, agregá este bloque:

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
    NOTIFY_URL: ${BACKUP_NOTIFY_URL:-}
    NOTIFY_TOKEN: ${BACKUP_NOTIFY_TOKEN:-}
  volumes:
    - ./backup/service-account.json:/etc/rclone/service-account.json:ro
```

### 3.4. Levantar el servicio

```bash
# Bajar la imagen más reciente
docker compose pull backup

# Levantar en background
docker compose up -d backup
```

---

## 4. Operaciones del día a día

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

## 5. Troubleshooting

### Drive: `googleapi: Error 403` o error de autenticación

1. Verificá que el archivo esté montado:
   ```bash
   docker compose exec backup cat /etc/rclone/service-account.json | head -3
   ```
   Debe mostrar `{ "type": "service_account", ...`. Si no, el volumen no está mapeando al path correcto.

2. Verificá que la carpeta de Drive está compartida con el email de la service account.

3. Confirmá que la **Drive API** está habilitada en el proyecto de Google Cloud.

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
- Verificá el timezone: si `TZ=America/Caracas`, las 2am locales son las 6:30am UTC.
- Revisá los logs del cron:
  ```bash
  docker compose exec backup cat /var/log/backup.log
  ```
