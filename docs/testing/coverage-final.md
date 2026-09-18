# DT9 · Coverage final (contraste con el baseline)

> Medición al cierre de la cobertura de remote functions. Comparar con `docs/testing/coverage-baseline.md`.

- **Fecha:** 2026-09-15
- **Comando:** `pnpm test:coverage` (container efímero + `vitest --run --coverage`, todos los proyectos)
- **Suite:** 102 test files · 982 tests verdes

## Totales

| Métrica    | Baseline | Final      | Δ         |
| ---------- | -------- | ---------- | --------- |
| Lines      | 18.06%   | **26.62%** | **+8.56** |
| Statements | 17.4%    | 25.55%     | +8.15     |
| Branches   | 11.55%   | 17.88%     | +6.33     |
| Functions  | 18.07%   | 23.71%     | +5.64     |

> Nota: el baseline se midió sin el proyecto `integration` (no existía todavía). El final incluye integration.

## Por área (líneas)

| Directorio                                    | Final |
| --------------------------------------------- | ----- |
| `src/lib/server/payments/**`                  | 95.8% |
| `src/lib/server/inventory/**`                 | 90.5% |
| `src/lib/schemas/**`                          | 83.7% |
| `src/lib/shared/**`                           | 81.2% |
| `src/lib/server/sales/**`                     | 62.2% |
| `src/lib/server/db/queries/purchaseOrders/**` | 31.1% |
| `src/lib/server/quotes/**`                    | 27.1% |
| `src/lib/server/db/queries/sales/**`          | 17.0% |
| `src/lib/remote/**`                           | 2.0%  |

`remote/**` sigue bajo a propósito: es el shell delgado (auth + delegate), cubierto por los tests de wrapper (Capa 3) y por E2E; la lógica testeable vive en `src/lib/server/**`.

## Thresholds bloqueantes (CI)

Configurados en `vite.config.ts`:

- Global: lines 24, statements 23, functions 21, branches 15.
- `src/lib/server/payments/**`: lines 88.
- `src/lib/server/inventory/**`: lines 80.

El job `Coverage` de CI corre `pnpm test:coverage` y falla si bajan.
