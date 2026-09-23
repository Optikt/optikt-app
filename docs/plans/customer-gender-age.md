---
plan name: customer-gender-age
plan description: Sexo opcional y edad visual
plan status: done
---

## Idea
Agregar `gender` (MASCULINO/FEMENINO/OTRO, opcional, nullable, sin backfill) a customers y hacer `birthDate` opcional. Capturar ambos campos en el flujo inline de venta/presupuesto (CustomerLookupInput) y en el alta/edición normal de cliente (customers/new, CustomerFormModal, CustomerInfoCard). Mostrar únicamente la EDAD (helper existente `calculateAge` en src/lib/dates.ts:145) donde hoy se muestra la fecha o donde el cliente aparece: card de detalle de cliente, step 3 del wizard de venta/presupuesto (SaleStep3Summary → SummaryHeader → SaleCustomerBanner), y vista de venta (SaleDetailCustomerCard). No interesa en tabla de clientes. Clientes existentes quedan con birth_date/gender null (sin migración de datos). Requisitos: ambos campos opcionales nunca bloquean crear venta/presupuesto; age display tolera null (muestra '-').

## Implementation
- DB schema: agregar columna nullable `gender: varchar({ length: 20 })` en src/lib/server/db/schema/customers.ts. Generar migración con `pnpm db:generate` (nueva 0046_*.sql) y aplicar con `pnpm db:migrate`. Sin backfill: filas existentes quedan NULL. Mantener `birthDate` timestamp tz mode string tal cual.
- Enum/labels: crear src/lib/shared/enums/customerGenders.ts con `CustomerGender` (MASCULINO, FEMENINO, OTRO), `ALL_CUSTOMER_GENDERS` (Object.values) y `CUSTOMER_GENDER_LABELS`; exportar desde src/lib/shared/enums/index.ts. Agregar label `gender: 'Género'` en el mapa customer de src/lib/components/history/display-utils.ts.
- Schemas: en src/lib/schemas/customers.ts → `birthDate` pasa a `z.iso.date('Fecha de nacimiento inválida').optional()` y agregar `gender: z.enum(ALL_CUSTOMER_GENDERS).optional()` (UpdateCustomerSchema.partial lo hereda). En src/lib/schemas/sales.ts → mismo agregado en `InlineCustomerSchema` (birthDate opcional ISO + gender opcional).
- Tipos/inputs server: extender `InlineCustomerInput` en src/lib/server/customerReference.ts (birthDate?: string; gender?: CustomerGender) y `NewCustomerData` en src/lib/components/sales/newSaleTypes.ts (birthDate?: string ISO; gender?: string).
- Persistencia inline: `createInlineCustomer` (customerReference.ts) y `resolveInlineCustomer` (src/lib/server/db/queries/customers.ts) deben pasar birthDate/gender a createCustomer con `|| null`. En src/lib/remote/customers.remote.ts: `createCustomerWithPrescription` y `updateCustomerForm` deben normalizar `gender || null` (y mantener `birthDate || null`); audit log ya registra campos nuevos.
- UI inline venta/presupuesto: en src/lib/components/sales/CustomerLookupInput.svelte agregar en modo create un FormDatepicker opcional 'Fecha de Nacimiento' (availableTo hoy) y un <select> nativo de género con opción vacía 'Sin especificar'; sincronizar a `newCustomer` como ISO string (dateToISODateString) / valor enum en `syncNewCustomer()` y limpiar en `cleanCustomerCreation()`. Ajustar el grid de 10 columnas. No agregar validación que bloquee submit.
- UI alta/edición normal: en src/lib/components/customers/CustomerFormModal.svelte (create y update), src/routes/(app)/customers/new/+page.svelte y el form de edición de src/lib/components/customers/detail/CustomerInfoCard.svelte agregar el mismo <select> de género con opción vacía y quitar `required` del FormDatepicker de birthDate. Extender `CustomerEditData` + `buildCustomerEditData` (src/lib/components/customers/detail/customerDetail.ts) con gender.
- Mostrar edad (solo edad, nunca fecha en vistas): reemplazar la fila 'Fecha de Nacimiento' por 'Edad' en CustomerInfoCard usando `calculateAge` (src/lib/dates.ts:145) → '26 años' o '-'. En src/lib/components/sales/step3/SaleStep3Summary.svelte derivar edad desde `newCustomer.birthDate` o `selectedCustomer.birthDate` y pasarla por SummaryHeader a SaleCustomerBanner (prop opcional). En src/lib/components/sales/detail/SaleDetailCustomerCard.svelte mostrar edad bajo el documento del cliente. Agregar `birthDate` (y gender) a la proyección `customer` en src/lib/server/db/queries/sales/reads.ts (2 sitios) y a `SaleWithRelations` en src/lib/server/db/queries/sales/types.ts.
- Tests y verificación: agregar casos de `calculateAge` (nacimiento con/sin cumpleaños del año, null/undefined) en src/lib/dates.spec.ts; actualizar src/lib/components/customers/detail/customerDetail.spec.ts por gender; extender src/lib/schemas/sales.spec.ts y quotes.spec.ts (newCustomer con birthDate/gender opcionales) y createSale.int.spec.ts / createNewQuote.int.spec.ts (persistencia inline). Correr `pnpm check`, `pnpm lint`, `pnpm test:unit` y `pnpm test:integration`.

## Required Specs
<!-- SPECS_START -->
- dt1-patterns
- dt9-test-harness
- dt1-payment-strategy
- dt1-split-protocol
- public-catalog-arch
- sale-subtotal-semantics
- customer-gender-age
<!-- SPECS_END -->