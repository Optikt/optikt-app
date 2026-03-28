# PLAN MAESTRO DE REFACTORIZACION

## Objetivo

Alinear la arquitectura de Optikt App con el flujo operativo real de la optica:

- Lentes/cristales con rasgos inherentes y tratamientos opcionales por proveedor del propio cristal.
- Matching estricto por rasgos/tratamientos y flexible ante ausencia de rangos (requiere consulta).
- Soporte real para compra por unidad/par, confirmaciones, excedentes fisicos y su reutilizacion exacta.
- Presupuestos reutilizables que se convierten en venta sin cliente/pagos obligatorios al presupuestar.
- Busqueda global con scopes/prefijos y parser optico robusto reutilizable en ventas/presupuestos.
- Mayor visibilidad UX de todo evento automatico, decision requerida y riesgo operativo.
- Modelo fiscal de IVA claro para productos y parametrizable para lentes.

## Postura de ejecucion

Este plan asume una reescritura agresiva del dominio actual.

Reglas de ejecucion:

- No se prioriza compatibilidad hacia atras.
- No se prioriza estabilidad de una app en produccion porque no existe un entorno real de produccion.
- Se permite romper el modelo actual si eso simplifica y mejora la arquitectura final.
- Se prefiere reemplazar directamente estructuras viejas antes que mantener adaptadores temporales.
- Se eliminara codigo legacy tan pronto el nuevo flujo equivalente exista.
- La prioridad es velocidad de ejecucion con claridad arquitectonica, no transiciones suaves.

---

## Respuestas directas a tus puntos

### 1) Que significa estructura de rasgos/politicas por item

Significa separar dos cosas que hoy estan mezcladas:

1. Rasgos inherentes del cristal (parte del item, no agregables):

- Ejemplo: fotocromatico (si/no), tipo, material, indice, tecnologia.
- Fotocromatico no se maneja como tratamiento opcional, es parte de la identidad del cristal.

2. Politicas de tratamientos opcionales sobre ese item especifico:

- Para AR y Bluecut (u otros), cada item define si:
  - ya viene inherente,
  - se puede agregar como extra,
  - no esta disponible.
- Esta disponibilidad depende del proveedor y aplica solo al cristal de ese proveedor.

Resultado: el sistema puede distinguir correctamente entre:

- Crystal Royal: item ya armado con combinaciones cerradas (sin extras).
- Novak/FreeForm: item base + extras permitidos segun proveedor/item.

### 2) Excedente como cristal fisico no OD/OI exclusivo

Se adopta como regla de dominio:

- El excedente es una unidad fisica de cristal sin tallar/cortar.
- No pertenece a OD ni OI.
- Puede usarse en cualquiera de los dos ojos, siempre que el match sea exacto para ese ojo.
- Para excedente no se usa logica de rango de catalogo: se usa matching exacto del item fisico disponible.

### 3) Tratamientos por proveedor del propio cristal

Se adopta explicitamente:

- Un tratamiento opcional solo se puede aplicar si el proveedor del cristal seleccionado lo ofrece para ese item.
- No se permite aplicar tratamiento de un proveedor A sobre cristal de proveedor B.
- El motor de validacion bloquea combinaciones cruzadas.

### 4) Que es el fulfillment plan

Es un plan de abastecimiento generado por backend antes de confirmar venta/presupuesto. No es solo UI.

Para cada necesidad de lente (normalmente 2 unidades por par de ojos), el plan decide y explica:

- Que unidades salen de inventario existente (catalogo terminado o excedentes).
- Que unidades hay que pedir a proveedor/lab.
- Si se puede pedir por unidad o hay que pedir por par.
- Si pedir por par generara excedente y como se registrara.
- Si algun caso requiere confirmacion manual (por ejemplo, proveedor vende por par pero a veces permite unidad bajo consulta).
- Costo operacional estimado (base + tratamiento + montaje + envio + recargo unidad si aplica).
- Alertas: low stock, requiere consulta, riesgo de sobrecosto, bloqueo por incompatibilidad.

En resumen: convierte reglas complejas en decisiones operativas visibles y auditables.

---

## Principios de diseno de dominio

1. Identidad del cristal separada de tratamientos opcionales.
2. Matching por firma de rasgos/tratamientos primero, rangos despues.
3. Si no hay rango declarado pero la firma coincide: estado CONSULT_REQUIRED.
4. Compra real modelada con unidad/par + politicas de excepcion.
5. Excedente como inventario unitario fisico reutilizable.
6. Toda accion automatica debe ser visible en UI (no solo toast).
7. Logica de parser/matching compartida entre Search, Presupuesto y Venta.

---

## Arquitectura objetivo (modulos)

1. Lens Catalog Core

- Define identidad del cristal y sus politicas de tratamientos.
- Expone contratos de matching por firma y por rangos.

2. Procurement Policy Engine

- Evalua unidad/par, minimos de compra, consulta, recargos, envio/montaje.

3. Fulfillment Planner

- Construye plan unitario por necesidad de lente y decide inventario/pedido/excedente.

4. Surplus Inventory

- Registra excedentes fisicos unitarios con trazabilidad y estado.

5. Quote Module

- Presupuestos con numero/titulo, items editables y conversion a venta.

6. Sales Module (refactor)

- Reusa planner y parser compartido; confirma y ejecuta plan.

7. Scoped Search

- Parser de prefijos/scopes + parser optico OD/OI reutilizable.

8. Tax/Pricing Layer

- IVA configurable por categoria/tipo con UX de precio final.

---

## Modelo de datos objetivo (alto nivel)

### A) Lentes

Nuevos campos/estructuras en item de catalogo:

- photochromicMode: INHERENT | NONE
- treatmentPolicy por tratamiento (AR, BLUECUT, etc):
  - INHERENT
  - OPTIONAL_EXTRA
  - NOT_AVAILABLE
- rangeAvailability:
  - EXACT_RANGES (hay rangos para comparar)
  - CONSULT_REQUIRED (proveedor no publica rangos)
- pricing/purchasePolicy por item:
  - pricingUnitList: UNIT | PAIR
  - allowsSingleUnitOrder: boolean
  - singleUnitRequiresConfirmation: boolean
  - singleUnitSurcharge: number
  - minOrderUnits: number
  - mountingPrice
  - shippingPrice

Nota: la politica de tratamiento se resuelve por item y proveedor del item.

### A.1) Politicas de tratamiento a nivel proveedor/laboratorio (CRITICO)

**Problema identificado:** las `treatmentPolicies` estan declaradas por item de catalogo,
pero en la practica muchos laboratorios definen politicas de tratamiento que aplican a
**todos** sus cristales, no a cada item individual.

Ejemplos reales:

| Laboratorio   | Politica                                                                          | Nivel correcto |
| ------------- | --------------------------------------------------------------------------------- | -------------- |
| Novak         | AR $15/lens para todos sus cristales, sin blue                                    | **Proveedor**  |
| FFTech        | AR $18/lens + Blueblock $8/lens, combinables                                      | **Proveedor**  |
| Cristal Royal | Sin tratamientos opcionales; variantes con AR/blue son items separados (INHERENT) | **Item**       |

**Consecuencia sin resolver:** si Novak cambia el precio de AR de $15 a $18, habria que actualizar
**todos** los items de Novak en catalogo manualmente (pueden ser decenas o cientos).
Lo mismo si FFTech agrega un nuevo tratamiento: habria que declararlo en cada item.

**Solucion propuesta: herencia de politicas con override por item.**

1. Nueva tabla/estructura: `supplier_treatment_policies` — define tratamientos por defecto
   a nivel proveedor/laboratorio (code, availability, additionalPrice, requiresConfirmation).
2. Cada item de catalogo **hereda** las politicas del proveedor por defecto.
3. Un item puede **sobrescribir** la politica del proveedor si necesita un comportamiento distinto
   (ej: un cristal especifico de Novak que no soporta AR por su material).
4. Items con tratamientos INHERENT (como Cristal Royal) ignoran la politica del proveedor
   para esos tratamientos — el dato vive en el item.
5. Al construir `CatalogItemForPlanning`, el sistema **resuelve** las politicas:
   `supplier defaults → merge con item overrides → resultado final`.

**El fulfillment planner NO cambia.** Recibe politicas ya resueltas — no le importa de donde vienen.

**Este cambio afecta:**

- Schema DB (nueva tabla + logica de resolucion en queries)
- Formulario de lentes (UI para configurar politicas a nivel proveedor y overrides por item)
- No necesita Seed/migracion de datos existentes, no hay app para migrar aun

### A.2) Stock genérico vs Surplus con Rx (PENDIENTE)

**Problema identificado (Phase 5 testing):** `lens_catalog_items.stock` es un contador entero
genérico que no tiene prescripción asociada. Para cristales **terminados** (FINISHED) pre-fabricados
esto tiene sentido — son genéricos. Pero para cristales de **laboratorio** (LAB), cada unidad
física tiene una Rx específica y debería rastrearse como `surplus_unit` con su `physicalSignature`.

**Estado actual:**
- `stock` es editable manualmente en el form para todos los tipos de lente.
- `surplus_units` tiene Rx, tratamientos, trazabilidad — es el modelo correcto para inventario con Rx.
- **No hay auto-incremento** de stock al crear surplus. Son independientes.
- El planner usa `stock` solo para FINISHED + CATALOG_STOCK; usa `surplus_units` para todo lo demás.

**Resolución propuesta (futura, no Phase 5):**
1. Ocultar campo `stock` en el form para lentes LAB (solo visible para FINISHED).
2. Para LAB, mostrar en la detail page un count derivado: `surplus_units WHERE status=AVAILABLE`.
3. Opcionalmente, agregar flujo de "ingreso manual de inventario" que cree `surplus_units` con Rx.

**Cuándo implementar:** Fase 5b o posterior, cuando se refine el wizard de ventas.

### B) Inventario de excedentes fisicos

Nueva entidad de unidades fisicas de excedente:

- id
- originType: SALE_PURCHASE_PAIR_EXCESS | MANUAL_ADJUSTMENT
- lensCatalogItemId
- supplierId
- physicalSignature (rasgos/tratamientos exactos)
- quantityAvailable (inicialmente 1 por unidad excedente)
- costSnapshot
- status: AVAILABLE | RESERVED | CONSUMED | VOID
- traceability: saleId de origen, purchase event, timestamps

Regla: matching de excedente es exacto por firma fisica y compatibilidad de necesidad del ojo.

### C) Fulfillment plan (persistencia opcional + snapshot en venta)

- planId
- saleDraftId o quoteDraftId
- planLines[] con:
  - requirementId
  - source: INVENTORY_CATALOG | INVENTORY_SURPLUS | SUPPLIER_ORDER | LAB_ORDER
  - unitsNeeded
  - unitsCovered
  - purchaseMode: UNIT | PAIR
  - createsSurplusUnits
  - requiresConfirmation
  - warnings[]
  - costBreakdown

### D) Presupuestos

Nuevas tablas:

- quotes
- quote_items
- quote_plan_snapshot (opcional, recomendado)

Campos clave:

- quoteNumber (autonumerico)
- title (obligatorio)
- status: DRAFT | APPROVED | CONVERTED | EXPIRED | CANCELLED
- customerId nullable
- conversionSaleId nullable

### E) Productos e IVA

Agregar:

- isTaxable
- taxRate
- salePriceIncludesTax
- salePriceNet
- salePriceGross

Defaults:

- Lentes/cristales: no gravable por defecto (configurable).
- Productos generales: 16% por defecto.

---

## Reglas de matching objetivo

### 1) Match por firma de rasgos/tratamientos (obligatorio)

Debe coincidir exactamente lo solicitado contra lo ofrecido para item final:

- Si solicitud = FOTO + AR, entonces FOTO + AR + BLUECUT no coincide.
- Si AR es opcional en item, coincide solo si se selecciona AR en la solicitud final.

### 2) Match por rangos

- Si item tiene rangos (EXACT_RANGES): se compara formula.
- Si item no tiene rangos (CONSULT_REQUIRED):
  - si firma coincide, retorna posible match en estado CONSULT_REQUIRED.
  - nunca retorna como compatibilidad total confirmada.

### 3) Ejes

- Axis no participa en comparacion de match de oferta.
- Axis se usa en montaje/tallado operativo, no para filtrar oferta.

### 4) Parser optico

Interpretar correctamente:

- od:+0.25 -0.50
- oi:-0.50 -0.50
- od:+0.25 -0.50 +2.00 (indica necesidad con adicion, tipicamente bifocal/progresivo)

Reglas parser:

- Formato soportado OD/OI (tambien aceptar OS como alias de OI).
- 2 valores: sphere, cylinder.
- 3 valores: sphere, cylinder, addition.
- Axis opcional y no condicionante de match.

---

## Scopes/prefijos de busqueda global

Prefijos propuestos:

- # numero de orden/presupuesto/documento rapido.
- @ pacientes/clientes.
- ! productos (SKU/codigo/nombre).
- - lentes/cristales.
- % proveedores/marcas.
- Sin prefijo: busqueda global mas amplia.

Busqueda de lentes con sintaxis combinada (scope \*):

- tipo/material/proveedor/stock/excedente.
- od/oi con parser optico.
- rasgos/tratamientos solicitados.

Comportamiento esperado:

- Resultado con secciones y badges: EXACT_MATCH, CONSULT_REQUIRED, LOW_STOCK, REQUIRES_CONFIRMATION, CREATES_SURPLUS.
- Enter desde barra global puede llevar a pagina de resultados completos con filtros avanzados.

---

## UX/UI objetivo (alta visibilidad)

Direccion visual:

- Interfaz densa, precisa, legible, orientada a operacion.
- Color solo para semantica de estado.
- Estados persistentes en pantalla para decisiones criticas.

Patrones obligatorios:

- Panel fijo de impacto operativo en Venta/Presupuesto.
- Alertas inline por item (no depender solo de toast).
- Resumen de acciones automaticas antes de confirmar:
  - Se tomara de inventario.
  - Se debe consultar.
  - Se comprara por par.
  - Quedara excedente.
  - Se aplicara tratamiento extra por proveedor.
- Indicadores de low stock muy visibles.
- Mensajes human-friendly y accionables.

---

## Flujo objetivo de Presupuesto

1. Crear presupuesto

- Reusa wizard de venta.
- Sin cliente obligatorio.
- Sin pagos.
- Requiere titulo y genera quoteNumber.

2. Editar y guardar

- Items, filtros/tratamientos, formula, precios sugeridos.
- Se puede recalcular plan.

3. Convertir a venta

- Boton Generar venta.
- Abre wizard de venta prellenado con items del presupuesto.
- Pide cliente en esta etapa.
- Permite editar items antes de checkout.

4. Trazabilidad

- Presupuesto queda marcado como CONVERTED y guarda saleId.

---

## Plan de ejecucion detallado por fases

## Fase 0 - Definicion ejecutable del nuevo dominio

Objetivo:

- Cerrar contratos de tipos/estados y decisiones de negocio.

Entregables:

- Tipos TS de rasgos/politicas/matching/planner.
- Diccionario de estados y etiquetas UX.
- Matriz de compatibilidad por proveedor/item/tratamiento.
- Lista de archivos/tablas legacy que se reemplazaran o eliminaran.

Criterios de salida:

- Contratos aprobados y suficientemente concretos para codificar sin reinterpretacion.
- Referencias creadas:
  - `src/lib/shared/contracts/*`
  - `docs/phase-0-domain-contracts.md`

## Fase 1 - Reemplazo directo del dominio de lentes

Objetivo:

- Implementar estructura de rasgos/politicas por item.

Cambios:

- Rediseñar schema DB de lentes para reflejar el modelo final.
- Eliminar o sustituir campos legacy ambiguos donde estorben.
- Reescribir query layer para exponer un unico contrato claro.
- Reescribir formularios/serializacion de lentes segun el nuevo modelo.

Criterios de salida:

- CRUD de lentes funcional con el nuevo modelo como unica fuente de verdad.
- ⚠️ **Pendiente:** schema DB aun no tiene `supplier_treatment_policies` — se implementa en Fase 5 (ver seccion A.1).

## Fase 2 - Motor de matching v2 ✅

Objetivo:

- Matching por firma + rangos + estado consult required.

Cambios:

- [x] Nuevo modulo de matching compartido (`src/lib/shared/matching/`).
  - `types.ts` — tipos input/output desacoplados del DB.
  - `signatureMatching.ts` — `matchesSignature()` + `evaluateLensCompatibility()`.
  - `opticalParser.ts` — `parseOpticalPrescription()` con prefijos OD/OI/OS.
  - `index.ts` — barrel export.
- [x] Tests unitarios intensivos (50 tests):
  - firma exacta, material null wildcard
  - exclusion por tratamiento extra INHERENT no solicitado
  - OPTIONAL_EXTRA no solicitado permitido
  - fotosensible mismatch bidireccional
  - CONSULT_REQUIRED bypass sin range check
  - EXACT_RANGES con sphere, cylinder, addition
  - rangos de cilindro filtran ranges applicables
  - ojo sin datos = no_data (no falla)
  - parser od/oi/os con y sin addition
  - parser unprefixed (ambos ojos iguales)
  - parser monocular (un solo ojo)
- [x] Build + lint + svelte-check limpio.

Criterios de salida:

- 100% de reglas core cubiertas en tests.

## Fase 3 - Procurement policy + Fulfillment planner como nucleo operativo ✅

Objetivo:

- Resolver unidad/par, consulta, excedente y costo operativo.

Cambios:

- [x] Nuevo modulo de planning (`src/lib/shared/planning/`).
  - `types.ts` — tipos desacoplados: `LensRequirement`, `CatalogItemForPlanning`, `FulfillmentPlan`, `FulfillmentPlanLine`, `LineCostBreakdown`, `SurplusInfo`, `PlanWarning`.
  - `fulfillmentPlanner.ts` — `buildFulfillmentPlan()` con estrategias UNIT y PAIR.
  - `index.ts` — barrel export.
- [x] Engine de politicas de compra integrado en planner:
  - UNIT pricing: cada ojo es una linea independiente.
  - PAIR pricing natural: OD+OS del mismo item → par sin excedente.
  - PAIR pricing single-eye: forzar par → surplus, o single con surcharge si policy permite.
  - `allowsSingleUnitOrder` + `singleUnitRequiresConfirmation` + `singleUnitSurcharge`.
  - `minimumOrderUnits` → warning BELOW_MINIMUM_ORDER.
- [x] Calculo de costo por linea: base + treatments (solo OPTIONAL_EXTRA) + surcharge + mounting + shipping.
- [x] Generacion de surplus con trazabilidad (catalogItemId, surplusUnits, surplusCostIncluded).
- [x] Warnings tipados: CONSULT_REQUIRED, REQUIRES_SINGLE_UNIT_CONFIRMATION, SINGLE_UNIT_SURCHARGE, CREATES_SURPLUS, BELOW_MINIMUM_ORDER.
- [x] Tests unitarios (22 tests):
  - UNIT pricing: par, single, con treatments, con mounting/shipping.
  - PAIR pricing: par natural, single con surcharge, single con confirmacion, forced pair → surplus.
  - CONSULT_REQUIRED propagation.
  - Minimum order units.
  - Mixed catalog items (UNIT + PAIR en mismo plan).
  - Treatment cost: solo OPTIONAL_EXTRA suma, INHERENT no suma.
  - Error: catalog item not found.
  - Real-world: progresivo par completo con AR + mounting + shipping.
- [x] Build + lint + svelte-check limpio.

Criterios de salida:

- Dado un carrito y formula, planner devuelve plan consistente y explicable.

## Fase 4 - Inventario de excedentes fisicos ✅

Objetivo:

- Persistir y reutilizar excedentes exactos.

Cambios:

- [x] Tabla `surplus_units` en DB schema (`src/lib/server/db/schema/surplusUnits.ts`).
  - Campos: originType, originSaleId, catalogItemId, supplierId, physicalSignature (JSON),
    status (AVAILABLE/RESERVED/CONSUMED/VOID), costSnapshot (JSON), consumedBySaleId,
    reservedForSaleId, reservedAt, consumedAt, voidedAt, notes.
  - Foreign keys a lensCatalogItems, suppliers, sales (origin, consumed, reserved).
  - Indices por catalogItemId, supplierId, status, originSaleId.
  - Enums derivados de contratos compartidos (SurplusOriginType, SurplusUnitStatus).
- [x] Relaciones Drizzle (`drizzle/relations.ts`): surplus → catalogItem, supplier, originSale, consumedBySale.
- [x] Schema barrel export actualizado.
- [x] Queries CRUD con lifecycle de movimientos (`src/lib/server/db/queries/surplusUnits.ts`):
  - `findSurplusUnitById`, `findAvailableSurplusByCatalogItemId`,
    `findAvailableSurplusForItems` (batch por multiples items).
  - `findSurplusByOriginSaleId` (trazabilidad de venta origen).
  - `createSurplusUnit` (SALE_PURCHASE_PAIR_EXCESS o MANUAL_ADJUSTMENT).
  - `reserveSurplusUnit` (AVAILABLE → RESERVED, con saleId).
  - `consumeSurplusUnit` (RESERVED → CONSUMED, con saleId).
  - `releaseSurplusUnit` (RESERVED → AVAILABLE, limpia reservacion).
  - `voidSurplusUnit` (AVAILABLE|RESERVED → VOID, con notas).
  - Todos aceptan `DbOrTx` para transacciones.
- [x] Modulo de lifecycle puro (`src/lib/shared/planning/surplusLifecycle.ts`):
  - `isValidTransition(from, to)` — valida transiciones de estado.
  - `getValidTransitionsFrom(status)` — transiciones permitidas.
  - `isTerminalStatus(status)` — CONSUMED y VOID son terminales.
- [x] Integracion con planner: `buildFulfillmentPlan` acepta `availableSurplus: SurplusUnitForPlanning[]`.
  - Antes de aplicar logica UNIT/PAIR, intenta fulfillmentear desde surplus (FIFO por catalog item).
  - Lineas de surplus: source=SURPLUS_STOCK, cost=0, surplusUnitId referenciado.
  - Remaining requirements pasan al flujo normal de ordering.
  - Surplus evita compra forzada por par (elimina surplus innecesario).
  - Backward-compatible: parametro es optional, default `[]`.
- [x] Nuevo tipo `SurplusUnitForPlanning` en types.ts (id, catalogItemId, costSnapshot).
- [x] Campo `surplusUnitId: string | null` en `FulfillmentPlanResultLine`.
- [x] Tests unitarios (46 tests en modulo planning):
  - Planner (30 tests): 8 nuevos tests de surplus:
    - Surplus single eye, surplus ambos ojos, surplus parcial (uno surplus + uno order).
    - Surplus no aplica a otros catalog items.
    - Surplus evita forced pair → no genera surplus nuevo.
    - Surplus + PAIR pricing mixto (uno surplus, uno forced pair → nuevo surplus).
    - Surplus vacio == sin surplus.
    - CONSULT_REQUIRED en linea de surplus.
  - Lifecycle (16 tests): todas las transiciones validas e invalidas, terminales.
- [x] Build + lint + svelte-check limpio. 288 tests totales pasando.

Criterios de salida:

- Excedente generado en escenarios de compra por par.
- Excedente reutilizable en OD u OI si coincide exacto.

## Fase 5 - Reescritura del wizard de ventas sobre el planner

Objetivo:

- Reutilizar planner y mostrar decisiones claras.

Cambios:

- **⚠️ CRITICO: Implementar politicas de tratamiento a nivel proveedor (ver seccion A.1 del modelo de datos).**
  - Nueva tabla `supplier_treatment_policies` con defaults por laboratorio.
  - Logica de resolucion: supplier defaults → merge con item overrides → `treatmentPolicies` final.
  - No necesita migrar datos existentes, no hay app en produccion para migrar. Se puede extraer politicas repetidas a nivel proveedor, pero sencllamente es mas facil hacerlo directo.
  - UI de proveedor/laboratorio: seccion para configurar tratamientos por defecto.
  - UI de item de catalogo: mostrar politicas heredadas, permitir override por item.
  - Al resolver `CatalogItemForPlanning`, usar la capa de resolucion (no leer directo del item).
- Step items con selector de tratamientos validado por proveedor/item.
- Panel de impacto operativo por item y total.
- Bloqueos/confirmaciones donde aplique.
- Eliminacion de validaciones viejas que ya no representen la realidad del flujo.
- Reorganizacion visual tajante para priorizar visibilidad operativa.
- Mejorar formulario de lentes: agrupacion logica de campos, feedback visual de errores inline (rangos, tratamientos, politica de compra), textos explicativos mas claros.
- **Migrar** `SaleStep2Items`, `SaleStep3Summary`, `NewSaleForm` de `$lib/utils/lensMatching` → `$lib/shared/matching`.
- **Eliminar** `$lib/utils/lensMatching.ts` y su test una vez migrados todos los consumidores.
- Corregir bug de display de pricing unit (muestra "Por Unidad" en vez de "Por Par").

Criterios de salida:

- Usuario entiende que pasara antes de confirmar.
- Sin decisiones ocultas.

## Fase 5b - Validación de fórmula, pricing de tratamientos y desglose de costos en wizard

Objetivo:

- Asegurar que las fórmulas del paciente sean válidas antes de avanzar en el wizard.
- Mostrar precios de tratamientos como líneas separadas (por cristal × 2).
- Resolver la ambigüedad de precios por unidad/par/montaje/envío con un desglose claro.

### 5b.1 — Validación de prescripción en Step 2

Actualmente el wizard permite avanzar con todos los campos de fórmula vacíos. Reglas:

1. **Esfera/Cilindro:** al menos uno debe tener valor (no vacío). Si ambos están vacíos,
   bloquear avance. Valor explícito `0` es válido (plano).
2. **Eje:** obligatorio si cilindro > 0. Si cilindro está vacío o es 0, eje es opcional.
3. **Adición:** obligatoria para bifocales, progresivos y ocupacionales.
   No puede ser 0 — no tiene sentido usar estos tipos de lente sin adición.
4. Validar por ojo habilitado (OD, OI, o ambos).
5. Mostrar errores inline por campo, no solo bloquear el botón.

Archivos afectados:
- `src/lib/components/sales/SaleStep2Items.svelte` — lógica de validación
- `src/lib/components/sales/NewSaleForm.svelte` — gate de avance Step 2 → Step 3
- Posiblemente `src/lib/schemas/` — schema Zod reutilizable para prescripción de venta

### 5b.2 — Tratamientos como líneas visibles en Step 2 y Step 3

Actualmente los tratamientos se muestran como badges. Mejoras:

1. **Step 2:** Al seleccionar un tratamiento (ej. Antirreflejo), mostrar:
   `Antirreflejo · $15,00 × 2 = $30,00` (precio por cristal × cantidad de ojos habilitados).
2. **Step 3 (resumen/desglose):** Los tratamientos aparecen como líneas separadas:
   ```
   Cristales Monofocales · CR39    $30,00  (2 uds)
   Antirreflejo                    $30,00  (2 uds × $15,00)
   ```
   Esto facilita la lectura para el óptico y para la factura/presupuesto al cliente.
3. El partner del usuario quiere verlo "como producto", pero no se cambiará el schema DB.
   Solo se cambia la presentación visual en el wizard.

Archivos afectados:
- `src/lib/components/sales/SaleStep2Items.svelte` — mostrar costo de tratamiento expandido
- `src/lib/components/sales/SaleStep3Summary.svelte` — líneas de tratamiento en desglose
- Posiblemente `src/lib/components/sales/saleItemHelpers.ts` — helpers de cálculo

### 5b.3 — Desglose claro de precios de cristales

El pricing actual es confuso porque mezcla conceptos. Resolver:

1. **Precio base:** Distinguir claramente si es por unidad o por par.
   - Si UNIT: mostrar `$X × 2 = $Y` (por ojo).
   - Si PAIR: mostrar `$X (par)` sin multiplicar.
2. **Montaje (mounting):** Mostrar como línea separada cuando aplique.
3. **Envío (shipping):** Mostrar como línea separada cuando aplique.
4. **Precio sugerido de venta:** Usar el multiplicador (`suggestedMultiplier`) del catálogo
   para calcular y mostrar el precio de venta recomendado al lado del costo.
   Fórmula: `(precioBase × cantOjos + tratamientos + montaje) × multiplicador`.
5. El usuario debe poder editar el precio final, pero ver la sugerencia como referencia.

Archivos afectados:
- `src/lib/components/sales/SaleStep2Items.svelte` — desglose visual de precio
- `src/lib/components/sales/SaleStep3Summary.svelte` — resumen con líneas separadas
- `src/lib/shared/planning/fulfillmentPlanner.ts` — ya tiene `LineCostBreakdown`, verificar completitud
- `src/lib/components/sales/saleItemHelpers.ts` — helpers de precio sugerido

### 5b.4 — Stock solo para FINISHED (nota de A.2)

Ocultar campo `stock` en el form de lentes para source=LAB. Solo visible para FINISHED.
Mostrar en detail page de LAB lenses un count derivado de `surplus_units` disponibles.

Archivos afectados:
- `src/lib/components/lenses/LensCatalogForm.svelte` — condicional por source
- `src/routes/(app)/lenses/[id]/+page.svelte` — mostrar surplus count para LAB

Criterios de salida:

- No se puede avanzar del Step 2 sin fórmula válida.
- Tratamientos visibles como líneas con precio × cantidad.
- Desglose de precio claro: base + tratamientos + montaje + envío.
- Precio sugerido visible como referencia.
- Stock oculto para lentes de laboratorio.

## Fase 6 - Creacion del modulo de presupuestos

Objetivo:

- Flujo completo quote -> sale.

Cambios:

- Nuevas tablas y remotes de quotes.
- UI para listado/creacion/edicion.
- Boton Generar venta con prefill del wizard.
- Reutilizacion explicita del planner y parser compartido.

Criterios de salida:

- Presupuesto sin cliente/pagos.
- Conversion trazable y editable.

## Fase 7 - IVA y pricing UX

Objetivo:

- Modelo fiscal claro y facil de usar.
- Se ejecuta antes de Dashboard/Reports para que todas las pantallas de precio muestren datos fiscales correctos desde el inicio.

Cambios:

- Campos de tax en productos.
- UI de precio final con desglose automatico neto/IVA/bruto.
- Defaults por categoria.

Criterios de salida:

- Usuario captura precio de venta sin friccion.
- Sistema guarda desglose fiscal consistente.

## Fase 8 - Dashboard con datos reales

Objetivo:

- Reemplazar valores hardcodeados del dashboard con metricas reales del sistema.

Cambios:

- Query layer para conteos y totales: clientes activos, ventas del dia/semana/mes, productos activos, low stock, presupuestos pendientes.
- `/dashboard/+page.server.ts` con carga paralela de metricas.
- Reemplazar tarjetas hardcodeadas en `/dashboard/+page.svelte` con datos reales.
- Seccion de actividad reciente (ultimas ventas, ultimos presupuestos convertidos).

Criterios de salida:

- Dashboard muestra datos reales y actualizados.
- Indicadores de low stock visibles.

## Fase 9 - Reportes

Objetivo:

- Modulo de reportes funcional con datos de ventas, inventario y clientes.

Cambios:

- Queries de reportes: ventas por periodo, snapshot de inventario, actividad de clientes, resumen fiscal/IVA.
- `src/lib/remote/reports.remote.ts` con remotes de consulta.
- `/reports/+page.server.ts` + componentes de reporte por pestanas.
- Filtros por rango de fecha, cliente, producto/lente, proveedor.
- Exportacion basica (CSV o impresion).

Criterios de salida:

- Reportes de ventas, inventario y clientes funcionales.
- Filtros por periodo y entidad.

## Fase 10 - Reescritura de busqueda global con scopes y parser compartido

Objetivo:

- Busqueda mas precisa y reutilizable.

Cambios:

- Parser de prefijos/scopes.
- Parser optico robusto OD/OI.
- Pagina de resultados completos al Enter.
- Integracion con ventas/presupuestos.
- Sustitucion de la barra actual por una interfaz centrada en scopes y resultados semanticos.
- **Migrar** `search.remote.ts` de `$lib/utils/opticalParser` → `$lib/shared/matching` (`parseOpticalPrescription`).
- **Eliminar** `$lib/utils/opticalParser.ts` una vez migrado.

Criterios de salida:

- Busqueda acotada por scope y atributos.
- Resultados con estados operativos visibles.

## Fase 11 - Limpieza final del modelo viejo

Objetivo:

- Dejar la base de codigo alineada unicamente al modelo nuevo.

Cambios:

- Eliminar campos, ramas y componentes legacy que ya no se usen.
- Eliminar contratos viejos, helpers ambiguos y codigo muerto.
- Ajustar tests al flujo final, sin duplicidad de comportamiento viejo.
- **Verificar** que `$lib/utils/lensMatching.ts` y `$lib/utils/opticalParser.ts` fueron eliminados en fases anteriores. Si no, eliminar aqui.
- **Verificar** que `$lib/utils/index.ts` ya no re-exporta codigo de matching/parser viejo.

Criterios de salida:

- No quedan puntos importantes del flujo dependiendo del modelo anterior.

## Fase 12 - Rediseno UI/UX completo

Objetivo:

- Rediseno visual de toda la aplicacion con todos los flujos funcionales ya definidos.
- Usar herramientas de prototipado (Stitch, design system generator) sobre pantallas reales.

Cambios:

- Generar design system formal (tipografia, paleta, espaciado, componentes) a partir del sistema existente.
- Prototipar todas las pantallas principales (~15-20 screens) con flujos reales.
- Aplicar rediseno a componentes existentes sin cambiar logica de negocio.
- Revision de accesibilidad, responsividad y consistencia visual.

Criterios de salida:

- Todas las pantallas rediseñadas y consistentes.
- Design system documentado y aplicado.

---

## Estrategia de reemplazo directo

1. Definir el modelo final primero.
2. Reescribir tablas/campos/contratos necesarios para soportarlo.
3. Migrar los datos minimos utiles si vale la pena; descartar lo ambiguo o inservible.
4. Reescribir consumidores clave: lentes, ventas, presupuestos, busqueda.
5. Eliminar el modelo anterior tan pronto el nuevo flujo compile y pase pruebas.

Nota:

- No se usara dual-read.
- No se usaran feature flags.
- No se mantendra codigo legacy solo por precaucion.

---

## Plan de pruebas

Tipos de pruebas:

- Unitarias:
  - parser optico,
  - matching por firma/rangos,
  - planner de fulfillment,
  - reglas unidad/par y excedente.
- Integracion:
  - quote -> sale,
  - stock/excedente,
  - tratamientos por proveedor.
- E2E:
  - crear presupuesto,
  - convertir a venta,
  - confirmar plan,
  - pago/checkout.
- UX QA:
  - visibilidad de alertas,
  - claridad de mensajes,
  - estados persistentes.

Casos criticos:

- Proveedor sin rangos + firma exacta.
- Solicitud FOTO+AR no debe traer FOTO+AR+BLUECUT.
- Compra por par para una necesidad unitaria genera excedente.
- Excedente se consume luego en OD o OI indistinto si match exacto.
- Tratamiento de proveedor A no aplicable en cristal de proveedor B.

---

## Observabilidad y auditoria

Se debe registrar:

- Decision del planner por linea.
- Confirmaciones manuales del usuario.
- Creacion/consumo de excedente.
- Conversion de presupuesto a venta.
- Cambios de politicas de item y disponibilidad de tratamientos.

---

## Riesgos y mitigaciones

Riesgo: complejidad del planner.
Mitigacion: iniciar con reglas deterministicas y sin optimizacion prematura.

Riesgo: inconsistencias durante migracion.
Mitigacion: reescribir con contratos claros y validar con pruebas de dominio antes de seguir a UI.

Riesgo: UX sobrecargada.
Mitigacion: jerarquia visual fuerte, badges semanticos y panel de impacto resumido.

Riesgo: rendimiento de busqueda global.
Mitigacion: scopes, limites por seccion, pagina dedicada para resultados amplios.

Riesgo: romper partes del flujo actual durante el reemplazo.
Mitigacion: aceptado como costo del refactor; se corrige en la misma rama hasta cerrar el flujo nuevo completo.

---

## Entregables finales esperados

1. Dominio de lentes/politicas refactorizado.
2. Planner de fulfillment operativo y explicado.
3. Inventario de excedentes fisicos unitarios en produccion.
4. Modulo de presupuestos con conversion a venta.
5. Modelo de IVA en productos con UX simple.
6. Dashboard con metricas reales.
7. Modulo de reportes funcional (ventas, inventario, clientes, fiscal).
8. Busqueda global con prefijos y parser optico compartido.
9. Suite de pruebas y observabilidad completa.
10. Rediseno UI/UX completo con design system formal.

---

## Orden de ejecucion recomendado

| Orden | Fase | Que              | Por que en esta posicion                                 |
| ----- | ---- | ---------------- | -------------------------------------------------------- |
| 1     | 5    | Wizard de ventas | Fundacion — todo se construye sobre esto                 |
| 2     | 6    | Presupuestos     | Reutiliza wizard directamente                            |
| 3     | 7    | IVA y pricing    | Cambio de schema — mejor antes de que Reports cristalice |
| 4     | 8    | Dashboard real   | Quick win, contadores de ventas + presupuestos           |
| 5     | 9    | Reportes         | Significativos ahora que ventas/presupuestos/IVA existen |
| 6     | 10   | Busqueda global  | Polish — mejora navegacion entre todas las entidades     |
| 7     | 11   | Limpieza legacy  | Barrido final antes del rediseno                         |
| 8     | 12   | Rediseno UI/UX   | Todos los flujos definidos, todas las pantallas existen  |

## Checklist de estado del plan

- [x] Plan maestro consolidado en raiz.
- [x] Postura agresiva de reemplazo directo definida.
- [x] Reglas de negocio clave incorporadas (feedback actual).
- [x] Definir contratos TS exactos (fase 0).
- [x] Reemplazar schema y contratos DB (fase 1).
- [x] Implementar motor matching v2 (fase 2).
- [x] Implementar planner + excedentes (fases 3-4).
- [ ] Refactor wizard ventas (fase 5) — **EN PROGRESO** (steps 1-3 completos, step 4 siguiente).
- [ ] Modulo presupuestos (fase 6).
- [ ] IVA y pricing UX (fase 7).
- [ ] Dashboard con datos reales (fase 8).
- [ ] Reportes (fase 9).
- [ ] Scoped search + parser compartido (fase 10).
- [ ] Eliminar codigo legacy sobrante (fase 11).
- [ ] Rediseno UI/UX completo (fase 12).

---

## Nota operativa

Este documento es la referencia unica de arquitectura/ejecucion para evitar perdida de contexto en sesiones futuras. Cualquier cambio de alcance o regla de negocio debe reflejarse aqui primero.
