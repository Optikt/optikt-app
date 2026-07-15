# PLAN MAESTRO — OPTIKT APP

## Postura de ejecucion

- Happy path primero. Los edge cases se abordan cuando aparezcan en el uso real.
- No se prioriza compatibilidad hacia atras (no hay produccion real aun).
- Se prefiere codigo simple y directo sobre abstracciones preventivas.
- Velocidad de entrega > cobertura teorica de casos raros.

---

## Estado base actual

- Backend core, CRUD principal, wizard de ventas/presupuestos, FIFO inventory, compras, dashboard y reportes basicos ya estan operativos.
- El redesign esta aplicado en `(auth)/+layout`, `(app)/+layout`, `/login`, `/dashboard`, `/customers`, `/sales`, `/quotes`, `/products`, `/lenses` y `/purchases`.
- Redesign completo del wizard de ventas (Step 1, 2, 3) para viewport 1280x559 — slide-overs, draft pattern, validación inline, resumen compacto.
- Redesign responsive de la lista de ventas (`/sales`) con columnas ajustables, stats inline, scroll horizontal controlado.
- Validacion actual: `pnpm test:unit` (715 tests), `pnpm check` 0 errors, `eslint` 0 errors.
- La deuda tecnica se documenta unicamente en `TECH_DEBT.md`.

---

## Plan activo

### Fase 10 — Redesign UI/UX pendiente

**Objetivo**

- Terminar de migrar las pantallas restantes al design system "Precision Visionary".
- Mantener el foco en implementacion visual; la deuda tecnica vive en `TECH_DEBT.md`.

**Referencia de diseno**

- Stitch project: `2149962653469234227`
- Showcase de tokens: `2025c374`

**Completado**

| Ruta                    | Alcance                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sales` (wizard)       | Redesign completo step 1, 2, 3 para 1280×559. Slide-overs, draft pattern, validacion inline, EyeSummary component, SaleItemInfo, context API. |
| `/sales` (listado)      | Redesign responsive con columnas ajustables, stats inline, scroll horizontal, ocultar vendedor en viewports angostos, filtros compactos.      |
| `/sales/[id]`           | Card de abonos compacta con scroll independiente, titulo fuera del scroll.                                                                    |
| Componentes compartidos | EyeSummary, SaleItemInfo, SaleCustomerBanner, routes.ts con tipos de rutas, matchesAllTokens para busqueda.                                   |

**Pendiente por pagina**

| Ruta                 | Estado    | Alcance pendiente                                                                        |
| -------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `/brands`            | pendiente | Migrar al design system la vista principal y cualquier flujo activo asociado de marcas.  |
| `/suppliers`         | pendiente | Migrar al design system la vista principal y los flujos activos de proveedores.          |
| `/users`             | pendiente | Migrar al design system la gestion de usuarios sin reintroducir permisos inconsistentes. |
| `/materials`         | pendiente | Migrar materiales al mismo lenguaje visual que productos y lentes.                       |
| `/config`            | parcial   | Completar PageHeader, tokens, formularios y limpieza visual restante.                    |
| `/reports`           | parcial   | Terminar hub de reportes con layout y tokens consistentes.                               |
| `/reports/sales`     | pendiente | Redesign completo del reporte de ventas.                                                 |
| `/reports/payments`  | pendiente | Redesign completo del reporte de pagos.                                                  |
| `/reports/inventory` | pendiente | Redesign completo del reporte de inventario.                                             |

**Orden sugerido**

1. `/brands`
2. `/suppliers`
3. `/users`
4. `/materials`
5. `/config`
6. `/reports`
7. `/reports/sales`
8. `/reports/payments`
9. `/reports/inventory`

**Criterio de cierre por pantalla**

- Usa componentes y tokens del design system vigente.
- No deja dependencias nuevas de shadcn-svelte en UI activa.
- Pasa `pnpm lint`, `pnpm test:unit` y `pnpm check`.

---

## Backlog de producto

Estos items no bloquean el plan activo de redesign, pero siguen pendientes a nivel de producto/alcance:

### Pendiente de implementacion posterior

- Migrar listados y search bars que hoy usan `+page.server.ts` + llamadas imperativas con `query(...).run()` al patron reactivo con remote functions ancladas en el componente usando `$derived(await query(...))`, manteniendo SSR, cache/dedup e invalidacion nativa. Hacerlo por modulo, empezando por un piloto pequeno antes de replicarlo al resto.

- Modulo de Ingresos y Egresos.
- Credit Notes / `RETURN_IN` para devoluciones parciales.
- Reporte de perdidas operativas.
- Conteo fisico multi-item.
- Ajustes de inventario para lentes con stock.
- Surplus / excedentes fisicos de cristales.
- Fulfillment planner (unit/pair policies, procurement engine).
- Busqueda global con scopes/prefijos y parser optico.
- Politicas de tratamiento heredadas por proveedor (`supplier_treatment_policies`).
- Presupuestos: expiracion automatica e historial de revisiones.
- Facturacion electronica / PDF oficial.
- Multi-sede / multi-usuario con permisos granulares.

---

## Flujo de trabajo

1. Disenar o validar en Stitch.
2. Implementar pantalla o grupo pequeno sin mezclar alcances innecesarios.
3. Comparar en localhost contra mockup o patrones ya migrados.
4. Validar con `pnpm lint`, `pnpm test:unit` y `pnpm check`.
5. Actualizar este archivo cuando cambie el estado real del plan.
