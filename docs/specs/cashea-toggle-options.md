# Cashea toggle — opciones visuales (wizard de venta)

Estado: exploración. Se prueban las 3 variantes en orden; A está implementada primero.

- Combinación elegida por ahora: **A en Step 1** (`size="lg"`) + **B en Step 3** (`size="md"`).
- C: descartada (banner + switch; no convenció).

## Problema

En el wizard, el selector "Venta con Cashea" (`CasheaCheckbox.svelte`) es demasiado
discreto:

- Logo Cashea a **16px** (`h-4 w-4`), mismo tamaño que el checkbox nativo.
- Label `text-xs` (12px), alto de la píldora ~36px.
- El orden actual es `checkbox → logo → texto`, así que la atención cae en el
  checkbox y no en la marca.

Afecta dos pantallas:

- **Step 1** (`step1/SaleStep1Info.svelte`): dentro de la tarjeta de cliente.
- **Step 3** (`step3/summary/SummaryHeader.svelte`): en la misma fila que el
  banner del cliente y el input de notas; al crecer, aplasta las notas.

## Opción A — Tarjeta de opción con logo 40–44px (en prueba)

```
┌───────────────────────────────────────────────────────────────┐
│  ┌──────┐   Venta con Cashea                          ┌────┐  │
│  │ 44px │   Financia el saldo a través de Cashea       │ ✓  │  │
│  └──────┘                                              └────┘  │
└───────────────────────────────────────────────────────────────┘
```

- Logo **44px** a la izquierda, título `text-sm font-semibold`, hint `text-[11px]`,
  check a la derecha.
- Alto ~60px; toda la tarjeta es el `<label>` (checkbox `sr-only` + `focus-within`),
  así que se mantiene accesible por teclado y lector de pantalla.
- Inactivo: borde `outline-variant/40`. Activo: borde `brand-gold` + `bg-brand-gold/10`
  - check visible.
- Step 1: se queda donde está. Step 3: pasa a fila propia debajo del header para
  devolverle el ancho a las notas.
- Implementación: prop `size="sm" | "lg"` en `CasheaCheckbox`; `sm` conserva el
  uso actual del rail de pagos (`variant="gold" disabled`).

## Opción B — Chip XL

```
[ ✓   ██  Venta con Cashea ]     logo 24–28px, alto 44px, label 14px
```

- Solo escala la píldora actual: logo **24–28px**, `py-3 px-4`, `text-sm font-semibold`,
  activo con `bg-brand-gold/15` + `ring-1 ring-brand-gold`.
- Se queda en la misma posición en las dos pantallas.
- Pros: un solo archivo, cero impacto de layout.
- Contras: sigue siendo discreto y en Step 3 le quita ~40px a las notas.

## Opción C — Banner con switch

```
┌───────────────────────────────────────────────────────────────┐
│  ████  Venta con Cashea                          [ ●──]        │
└───────────────────────────────────────────────────────────────┘
```

- Banner full-width, logo **48px**, switch a la derecha (`role="switch"`).
- Pros: máxima visibilidad.
- Contras: tono "marketing" en una herramienta operativa densa; cambia el
  affordance de checkbox a switch y en Step 3 obliga igual a mover la fila.

## Cambios comunes a las tres

| Antes                               | Después                               |
| ----------------------------------- | ------------------------------------- |
| `checkbox → logo 16px → texto 12px` | `logo → texto → check`                |
| alto 36px                           | 44px (B) / ~60px (A)                  |
| logo 16px                           | 24–28px (B) / 44px (A)                |
| sin estado visual de marca          | borde y fondo dorados al estar activo |

## Criterios de aceptación

- El logo Cashea es legible sin zoom en Step 1 y Step 3.
- El área clicable cumple el target táctil (>44px de alto en A y B).
- El estado se anuncia correctamente (checkbox real, no `div` clickeable).
- Las notas del Step 3 no pierden ancho respecto a la versión actual.
- El rail de pagos (`variant="gold" disabled`) queda visualmente igual.
