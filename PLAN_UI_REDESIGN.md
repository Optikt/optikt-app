# PLAN UI/UX REDESIGN — OPTIKT APP

## Postura

- Pantalla por pantalla. No se hace todo de una.
- Tokens base primero, luego screens.
- Stitch genera los diseños; el código los implementa fielmente.
- PRs progresivas: cada pantalla (o grupo pequeño) es un PR independiente.
- Sin cambios en lógica de negocio. Solo visual + deuda técnica relacionada.
- Si un componente compartido necesita refactor para el redesign, se hace en el PR que lo toca primero.

---

## Fase 0 — Design Tokens & Foundation

**Fuente:** Stitch brand system + tokens base  
**Estado:** completada

### Entregables

- [x] Paleta base de colores semánticos (primary, secondary, accent, error, neutral, surface)
- [x] Tipografía base (Inter + Space Grotesk)
- [x] Spacing scale (4px grid)
- [x] Border radius system
- [x] Depth strategy (shadows/borders)
- [x] Theme global actualizado en Tailwind v4 vía `src/routes/layout.css` (este repo no usa `tailwind.config.ts`)
- [x] `layout.css` actualizado (global resets, base tokens)
- [x] Componentes base actualizados: `AppBadge` reemplaza Flowbite `Badge`, todos los domain badges migrados
- [x] Colores semánticos completos: `success` (#12B76A), `warning` (#F79009), `info`, `purple` con container/on-container

### Deuda técnica resuelta

- [x] **RT-2** — Consolidado: `BadgeVariant` type (`success | warning | error | neutral | info | purple`), todas las funciones `getXxxBadgeColor()` ahora retornan `BadgeVariant` en vez de colores Flowbite. 9 badge components migrados a `AppBadge`.

---

## Fase 1 — Login

**Fuente:** Stitch login screen  
**Estado:** completada

### Pantallas

- [x] `/login` — [src/routes/(auth)/login/+page.svelte](<src/routes/(auth)/login/+page.svelte>)
- [x] `(auth)/+layout.svelte` — [src/routes/(auth)/+layout.svelte](<src/routes/(auth)/+layout.svelte>) (verificado; sin cambios visuales requeridos)

### Notas de implementación

- Imagotipo izquierdo: `/static/imagotipos/vertical/optikt-white-yellow.png`
- Logo derecho: `/static/logos/optikt-original.png`
- Versión del login: inyectada desde `package.json`
- Validación: `pnpm build`, `pnpm lint` y tests unitarios en verde

---

## Fase 2 — App Shell & Dashboard

**Fuente:** Stitch dashboard screen  
**Estado:** pendiente

### Pantallas

- [ ] `(app)/+layout.svelte` — sidebar, navbar, shell general
- [ ] `/dashboard` — StatCards, cobros pendientes, ventas recientes, bajo stock, quick actions

---

## Fase 3 — Clientes

**Fuente:** Stitch clientes screen  
**Estado:** pendiente

### Pantallas

- [ ] `/customers` — lista con DataTable
- [ ] `/customers/[id]` — detalle del cliente

---

## Fase 4 — Ventas

**Fuente:** Stitch sales list + sale detail screens  
**Estado:** pendiente

### Pantallas

- [ ] `/sales` — lista de ventas (SalesTable, filtros, badges)
- [ ] `/sales/[id]` — detalle de venta (artículos, pagos, movimientos, cancel modal, refund info)
- [ ] `/sales/new` — wizard de venta (3 pasos)

### Deuda técnica a resolver aquí

- **RT-3** — Componente genérico `ReactivateEntityModal` (al tocar modals de cancel/reactivar)

---

## Fase 5 — Presupuestos

**Estado:** pendiente

### Pantallas

- [ ] `/quotes` — lista
- [ ] `/quotes/[id]` — detalle
- [ ] `/quotes/new` — wizard

---

## Fase 6 — Productos & Inventario

**Fuente:** Stitch inventario screen  
**Estado:** pendiente

### Pantallas

- [ ] `/products` — lista con DataTable
- [ ] `/products/create` — formulario de creación
- [ ] `/products/[id]` — detalle (info, stock, movimientos, ajustes)
- [ ] `/products/[id]/update` — edición
- [ ] `/products/[id]/adjustments` — ajustes de inventario

### Deuda técnica a resolver aquí

- **RT-1** — Estandarizar `ReactivateXxxSchema` a factory function (al tocar reactivar producto)

---

## Fase 7 — Lentes

**Estado:** pendiente

### Pantallas

- [ ] `/lenses` — lista/catálogo
- [ ] `/lenses/create` — creación
- [ ] `/lenses/[id]` — detalle
- [ ] `/lenses/[id]/edit` — edición

---

## Fase 8 — Compras & Movimientos

**Estado:** pendiente

### Pantallas

- [ ] `/purchases` — lista de órdenes de compra
- [ ] `/purchases/new` — nueva orden
- [ ] `/purchases/[id]` — detalle de orden
- [ ] `/purchases/movements` — historial unificado de movimientos

---

## Fase 9 — Configuración & Catálogos

**Estado:** pendiente

### Pantallas

- [ ] `/config` — configuración general (IVA, moneda, etc.)
- [ ] `/brands` — marcas
- [ ] `/materials` — materiales
- [ ] `/suppliers` — proveedores
- [ ] `/users` — usuarios

---

## Fase 10 — Reportes

**Estado:** pendiente

### Pantallas

- [ ] `/reports` — hub de reportes
- [ ] `/reports/sales` — reporte de ventas
- [ ] `/reports/payments` — reporte de pagos
- [ ] `/reports/inventory` — reporte de inventario

---

## Inventario completo de pantallas (32 pages + 4 layouts)

| #   | Ruta                           | Fase | Estado     |
| --- | ------------------------------ | ---- | ---------- |
| L1  | `+layout.svelte` (root)        | 0    | pendiente  |
| L2  | `(auth)/+layout.svelte`        | 1    | completada |
| L3  | `(app)/+layout.svelte`         | 2    | pendiente  |
| L4  | `products/[id]/+layout.svelte` | 6    | pendiente  |
| 1   | `/login`                       | 1    | completada |
| 2   | `/dashboard`                   | 2    | pendiente  |
| 3   | `/customers`                   | 3    | pendiente  |
| 4   | `/customers/[id]`              | 3    | pendiente  |
| 5   | `/sales`                       | 4    | pendiente  |
| 6   | `/sales/[id]`                  | 4    | pendiente  |
| 7   | `/sales/new`                   | 4    | pendiente  |
| 8   | `/quotes`                      | 5    | pendiente  |
| 9   | `/quotes/[id]`                 | 5    | pendiente  |
| 10  | `/quotes/new`                  | 5    | pendiente  |
| 11  | `/products`                    | 6    | pendiente  |
| 12  | `/products/create`             | 6    | pendiente  |
| 13  | `/products/[id]`               | 6    | pendiente  |
| 14  | `/products/[id]/update`        | 6    | pendiente  |
| 15  | `/products/[id]/adjustments`   | 6    | pendiente  |
| 16  | `/lenses`                      | 7    | pendiente  |
| 17  | `/lenses/create`               | 7    | pendiente  |
| 18  | `/lenses/[id]`                 | 7    | pendiente  |
| 19  | `/lenses/[id]/edit`            | 7    | pendiente  |
| 20  | `/purchases`                   | 8    | pendiente  |
| 21  | `/purchases/new`               | 8    | pendiente  |
| 22  | `/purchases/[id]`              | 8    | pendiente  |
| 23  | `/purchases/movements`         | 8    | pendiente  |
| 24  | `/config`                      | 9    | pendiente  |
| 25  | `/brands`                      | 9    | pendiente  |
| 26  | `/materials`                   | 9    | pendiente  |
| 27  | `/suppliers`                   | 9    | pendiente  |
| 28  | `/users`                       | 9    | pendiente  |
| 29  | `/reports`                     | 10   | pendiente  |
| 30  | `/reports/sales`               | 10   | pendiente  |
| 31  | `/reports/payments`            | 10   | pendiente  |
| 32  | `/reports/inventory`           | 10   | pendiente  |

---

## Deuda técnica (se resuelve durante el redesign)

| ID   | Descripción                                           | Se resuelve en |
| ---- | ----------------------------------------------------- | -------------- |
| RT-1 | Estandarizar `ReactivateXxxSchema` a factory function | Fase 6         |
| RT-2 | Consolidar `getXxxLabel()` / `getXxxBadgeColor()`     | Fase 0         |
| RT-3 | Componente genérico `ReactivateEntityModal`           | Fase 4         |

---

## Flujo de trabajo por fase

1. Diseñar en Stitch → exportar tokens/mockups
2. Crear sub-branch `redesign/<scope>` desde `ui-redesign`
3. Implementar cambios visuales (sin tocar lógica de negocio)
4. Revisar en localhost — comparar con mockup
5. `pnpm lint && pnpm test` — 0 errores
6. PR → merge a `ui-redesign`
7. Cuando `ui-redesign` acumule suficientes fases estables → merge a `main`
