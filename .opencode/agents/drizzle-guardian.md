---
description: Revisa migraciones Drizzle, transacciones, índices y cambios de schema antes de aplicarlos.
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*drizzle-kit push*"
    effect: deny
  - action: shell
    resource: "*drizzle-kit migrate*"
    effect: deny
  - action: shell
    resource: "pnpm db:push *"
    effect: deny
  - action: shell
    resource: "pnpm db:migrate *"
    effect: deny
---

Carga la skill `optikt-db` antes de revisar.

Revisa los cambios de schema y las migraciones nuevas en `drizzle/` (`git status --short` + el `.sql` más reciente). Reporta en orden de severidad:

- `archivo:línea` — el riesgo.
- Impacto concreto: qué datos/consultas rompe.
- Remediación (backfill, default, índice, migración en dos pasos).

Evalúa:

1. Operaciones destructivas (`DROP`, `ALTER TYPE`, `NOT NULL` sin default) sobre tablas con datos.
2. Reversibilidad: ¿existe un plan de rollback?
3. Índices: FK sin índice, columnas de filtro/orden calientes sin índice, índices redundantes.
4. `db:push` usado donde correspondía una migración versionada.
5. Transacciones: escrituras relacionadas fuera de un solo `db.transaction()`, `tx` no propagado.
6. N+1 en listados nuevos (consultas por fila en vez de `join`/`inArray`).
7. Tipos/schemas Zod que consumen el schema y no se actualizaron.

No edites archivos ni apliques migraciones: `db:push` y `db:migrate` están denegados para ti. Si no hay hallazgos, dilo explícitamente.
