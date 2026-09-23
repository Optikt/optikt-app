# Spec: customer-gender-age

Scope: feature

# Customer gender & age display

## Purpose

Capturar sexo y fecha de nacimiento del cliente en cualquier punto de alta (flujo inline de venta/presupuesto y alta/edición normal) sin bloquear la operación, y mostrar **solo la edad** en las vistas donde aparece el cliente.

## Data model

- `customers.gender`: `varchar(20)`, **nullable**. Valores: `MASCULINO`, `FEMENINO`, `OTRO`. Sin valor = `NULL` (se muestra vacío/'-').
- `customers.birth_date`: timestamp tz (ya existía), ahora **opcional** en todos los schemas de entrada.
- **Sin backfill**: clientes existentes conservan `birth_date`/`gender` como estaban. No hay migración de datos, solo DDL de columna nullable.
- Enum reusable: `CustomerGender`, `ALL_CUSTOMER_GENDERS`, `CUSTOMER_GENDER_LABELS` en `src/lib/shared/enums/customerGenders.ts`.

## Rules

1. `gender` y `birthDate` son **siempre opcionales**. Dejarlos vacíos nunca invalida ni bloquea crear cliente, venta o presupuesto.
2. Alta inline (CustomerLookupInput) y alta/edición normal (customers/new, CustomerFormModal, CustomerInfoCard edit) ofrecen ambos campos.
3. El input de nacimiento es un datepicker con `availableTo = hoy` (sin fechas futuras).
4. Los inputs de fecha guardan ISO date-only (`YYYY-MM-DD`) en DB; la UI usa Date local para el datepicker.
5. Display: se muestra **edad**, nunca la fecha cruda, en:
   - Card de detalle cliente (CustomerInfoCard) → fila "Edad".
   - Step 3 del wizard venta/presupuesto (SaleStep3Summary → SummaryHeader → SaleCustomerBanner), tanto cliente existente como cliente nuevo.
   - Vista de venta (SaleDetailCustomerCard) → edad bajo documento del cliente.
   - Tabla de clientes: sin cambios (no mostrar edad).
6. Edad = años cumplidos usando `calculateAge` (`src/lib/dates.ts`). Sin `birthDate` → `-` (o se omite la línea). Nunca mostrar edad negativa ni "0 años" para fechas futuras inválidas (input ya lo restringe).
7. Cliente existente se resuelve por cédula antes de crear; si ya existe se selecciona y no se crea duplicado (comportamiento actual intacto).

## Edge cases

- `birthDate` nulo + `gender` nulo → cliente se crea igual; resumen muestra solo nombre/documento.
- Cumpleaños aún no cumplido en el año actual → edad = año actual − año nacimiento − 1.
- 29 de febrero → cálculo por año/mes/día, `calculateAge` ya lo maneja.
- Limpiar el select de género envía `''` → se persiste `NULL`.
- Editar cliente sin tocar los campos no debe borrar valores existentes (partial update).

## Out of scope

- Backfill de clientes históricos.
- Filtros/búsqueda por género o edad.
- Mostrar edad en tabla de clientes, PDFs de venta/presupuesto o recibos.
- Validación cruzada género/fecha.
