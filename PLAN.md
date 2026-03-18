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

## Fase 4 - Inventario de excedentes fisicos

Objetivo:

- Persistir y reutilizar excedentes exactos.

Cambios:

- Tabla de excedentes.
- Movimientos: crear, reservar, consumir, liberar.
- Integracion con planner para priorizar inventario existente.

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

## Fase 7 - Reescritura de busqueda global con scopes y parser compartido

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

## Fase 8 - IVA y pricing UX

Objetivo:

- Modelo fiscal claro y facil de usar.

Cambios:

- Campos de tax en productos.
- UI de precio final con desglose automatico neto/IVA/bruto.
- Defaults por categoria.

Criterios de salida:

- Usuario captura precio de venta sin friccion.
- Sistema guarda desglose fiscal consistente.

## Fase 9 - Limpieza final del modelo viejo

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
5. Busqueda global con prefijos y parser optico compartido.
6. Modelo de IVA en productos con UX simple.
7. Suite de pruebas y observabilidad completa.

---

## Checklist de estado del plan

- [x] Plan maestro consolidado en raiz.
- [x] Postura agresiva de reemplazo directo definida.
- [x] Reglas de negocio clave incorporadas (feedback actual).
- [x] Definir contratos TS exactos (fase 0).
- [x] Reemplazar schema y contratos DB fase 1.
- [x] Implementar motor matching v2.
- [x] Implementar planner + excedentes.
- [ ] Refactor wizard ventas.
- [ ] Modulo presupuestos.
- [ ] Scoped search + parser compartido.
- [ ] IVA y pricing UX.
- [ ] Eliminar codigo legacy sobrante.

---

## Nota operativa

Este documento es la referencia unica de arquitectura/ejecucion para evitar perdida de contexto en sesiones futuras. Cualquier cambio de alcance o regla de negocio debe reflejarse aqui primero.
