# DT9 · Coverage baseline

> Punto de partida medido **antes** de agregar tests de remote functions. Contraste al cierre en `docs/plans/dt9-remote-tests.md`.

- **Fecha:** 2026-09-14
- **Comando:** `pnpm test:coverage` (`vitest --run --coverage`, provider v8)
- **Versiones:** vitest 5.0.0 · @vitest/coverage-v8 5.0.0 · @sveltejs/kit 2.70.3
- **Suite:** 87 test files · 936 tests verdes

## Totales

| Métrica    | Cobertura         |
| ---------- | ----------------- |
| Statements | 17.4% (995/5716)  |
| Branches   | 11.55% (532/4603) |
| Functions  | 18.07% (206/1140) |
| Lines      | 18.06% (964/5336) |

## Por directorio (líneas)

| Directorio                        | Líneas          | Statements | Branches | Functions |
| --------------------------------- | --------------- | ---------- | -------- | --------- |
| `src/lib/remote/**`               | 0.1% (2/2255)   | 0.1%       | 0.0%     | 0.0%      |
| `src/lib/server/**`               | 7.6% (153/2024) | 6.8%       | 2.9%     | 7.6%      |
| `src/lib/server/db/queries/**`    | 1.0% (16/1582)  | 0.9%       | 2.3%     | 0.4%      |
| `src/lib/server/payments/**`      | 0.0% (0/3)      | 0.0%       | 0.0%     | 0.0%      |
| `src/lib/server/audit/**`         | 0.0% (0/67)     | 0.0%       | 0.0%     | 0.0%      |
| `src/lib/server/exchangeRates/**` | 8.2% (10/122)   | 7.9%       | 10.8%    | 2.8%      |
| `src/lib/shared/**`               | 81.1% (539/665) | 79.9%      | 57.7%    | 69.3%     |
| `src/lib/schemas/**`              | 68.9% (270/392) | 65.9%      | 64.7%    | 68.1%     |

## Lectura

- `schemas` y `shared` (math/dominio puro) ya están sanos: los tests existentes los cubren bien.
- `remote`, `server/db/queries`, `server/payments` y `server/audit` están en ~0: es exactamente la orquestación y el acceso a DB que DT9 viene a cubrir.
- El total global está dominado por código de DB/orquestación no ejecutado; los porcentajes por área son más útiles que el global para medir DT9.

## Política al cierre

Ratchet bloqueante (ver `docs/specs/dt9-test-harness.md`):

- Floor global = medido final −2pts.
- Globs de dinero/stock (`server/payments/**`, `server/db/queries/sales/**`, `server/db/queries/purchaseOrders/**`) con barra más alta que el global.
