# Notificaciones y Tasas de Cambio

## Notificaciones

Las notificaciones se publican desde el servidor y aparecen en tiempo real (polling cada 30 s) en la campana del navbar. Cada notificación es visible solo para los roles que se configuren en `targetRoles`.

### Tipos y severidades disponibles

**`NotificationType`** (en `src/lib/shared/enums.ts`):

| Valor            | Cuándo usarlo                                       |
| ---------------- | --------------------------------------------------- |
| `STOCK_LOW`      | Stock de un producto bajo mínimo                    |
| `BACKUP_CREATED` | Backup de BD exitoso                                |
| `RATE_UPDATED`   | Tasas de cambio actualizadas externamente           |
| `RATE_OUTDATED`  | Tasas desactualizadas (sin respuesta del proveedor) |

**`NotificationSeverity`**: `INFO` · `SUCCESS` · `WARNING` · `ERROR`

**`UserRole`** (targetRoles): `ADMIN` · `MANAGER` · `EMPLOYEE`

### Agregar un nuevo tipo de evento

**1. Registrar el tipo en el enum** (`src/lib/shared/enums.ts`):

```ts
export enum NotificationType {
	// ... existentes
	SALE_CREATED = 'SALE_CREATED'
}
```

**2. Crear el builder** en `src/lib/server/notifications/service.ts`:

```ts
export async function notifySaleCreated(input: {
	saleId: string;
	clientName: string;
	total: number;
	executor?: DbOrTx;
}) {
	return publishNotification(
		{
			type: NotificationType.SALE_CREATED,
			severity: NotificationSeverity.SUCCESS,
			title: `Nueva venta: ${input.clientName}`,
			body: `Total: ${input.total.toFixed(2)} Bs`,
			metadata: { saleId: input.saleId, total: input.total },
			targetRoles: [UserRole.ADMIN, UserRole.MANAGER]
			// link es opcional: solo rutas con forma `/products/${id}`
			// link: `/products/${input.saleId}`,
		},
		input.executor
	);
}
```

> El campo `link` acepta solo `NotificationLink` (`/products/${string}`). Para navegar a otras rutas hay que extender ese tipo en `src/lib/shared/notifications.ts`.

**3. Llamar el builder desde el remote command** (siempre _fuera_ de la transacción):

```ts
// src/lib/remote/sales.remote.ts
export const createSaleCommand = command(async ({ data }) => {
	let sale: Sale;

	await db.transaction(async (tx) => {
		sale = await createSale(data, tx);
		await updateInventory(data.items, tx);
	});

	// Best-effort: si falla no interrumpe el flujo principal
	await notifySaleCreated({
		saleId: sale.id,
		clientName: sale.clientName,
		total: sale.total
	});
});
```

> Los audit logs y notificaciones van **después** de la transacción, nunca dentro. Si la notificación falla, la operación principal ya fue confirmada.

### Builders ya disponibles

| Función                                                      | Cuándo llamarla                                  |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `notifyStockLow({ productId, productName, currentStock })`   | Al procesar una venta que deja stock bajo mínimo |
| `notifyBackupCreated({ fileName, sizeBytes?, durationMs? })` | Al finalizar un proceso de backup                |
| `notifyRatesUpdated({ refreshedAt, updatedKeys })`           | Automático desde el poller de tasas              |
| `notifyRateOutdated({ lastFetchedAt, lastError })`           | Automático desde el poller de tasas              |

---

## Tasas de Cambio

El sistema consulta una API externa para obtener tasas en tiempo real. Si la URL no está configurada, el widget del navbar muestra un mensaje de error sin romper la app.

### Variables de entorno

```bash
# URL base de la API (obligatoria para activar el feature)
EXCHANGE_RATES_API_URL="https://tu-api.com/rates"

# API key (opcional, se envía como `Authorization: Bearer <key>`)
EXCHANGE_RATES_API_KEY="tu-api-key"

# Intervalo de polling del servidor en ms (default: 300000 = 5 min)
EXCHANGE_RATES_POLL_INTERVAL_MS="300000"

# Umbral para marcar tasas como desactualizadas en ms (default: 1800000 = 30 min)
EXCHANGE_RATES_STALE_THRESHOLD_MS="1800000"
```

### Formato de respuesta esperado de la API

La API debe retornar JSON con este schema:

```json
{
	"usd_bcv": {
		"value": 36.5,
		"is_stale": false,
		"last_updated": "2026-06-02T12:00:00Z",
		"data_age_seconds": 120
	},
	"eur_bcv": {
		"value": 39.1,
		"is_stale": false,
		"last_updated": "2026-06-02T12:00:00Z",
		"data_age_seconds": 120
	},
	"usdt_binance": {
		"value": 36.45,
		"is_stale": false,
		"last_updated": "2026-06-02T12:00:00Z",
		"data_age_seconds": 300
	}
}
```

Las claves reconocidas están en `src/lib/server/exchangeRates/service.ts` (`KNOWN_RATE_KEYS`). Las claves desconocidas se ignoran. Para agregar una nueva moneda, añadir la entrada al mapa:

```ts
const KNOWN_RATE_KEYS: Record<string, { code: string; label: string }> = {
	usd_bcv: { code: 'USD', label: 'USD (BCV)' },
	eur_bcv: { code: 'EUR', label: 'EUR (BCV)' },
	usdt_binance: { code: 'USDT', label: 'USDT (Binance)' },
	// nueva:
	cop_bcv: { code: 'COP', label: 'COP (BCV)' }
};
```

### Configuración en producción (Docker Compose)

Agregar las variables al servicio `optikt-app` en `docker-compose-prod.yml`:

```yaml
services:
  optikt-app:
    environment:
      # ... variables existentes ...
      EXCHANGE_RATES_API_URL: ${EXCHANGE_RATES_API_URL:-}
      EXCHANGE_RATES_API_KEY: ${EXCHANGE_RATES_API_KEY:-}
      EXCHANGE_RATES_POLL_INTERVAL_MS: ${EXCHANGE_RATES_POLL_INTERVAL_MS:-300000}
      EXCHANGE_RATES_STALE_THRESHOLD_MS: ${EXCHANGE_RATES_STALE_THRESHOLD_MS:-1800000}
```

Y definir los valores en el archivo `.env` del servidor (nunca en el compose directamente):

```bash
# .env en el servidor de producción
EXCHANGE_RATES_API_URL=https://tu-api.com/rates
EXCHANGE_RATES_API_KEY=tu-api-key-secreta
```

> `${VAR:-}` hace que Docker Compose no falle si la variable no está definida — el feature simplemente queda desactivado.
