---
description: Prepara y revisa una migración Drizzle sin aplicarla sin confirmación
---

Prepara una migración para el cambio de schema en curso.

Contexto:

!`git status --short && git diff --stat -- src/lib/server/db/schema`

Pasos:

1. `pnpm db:generate` y muestra el archivo nuevo en `drizzle/`.
2. Lee el SQL generado y evalúa:
   - operaciones destructivas (`DROP`, `ALTER TYPE`, `NOT NULL` sin default),
   - datos en riesgo y si hace falta backfill,
   - índices faltantes para FKs o columnas de filtro/orden,
   - plan de rollback concreto.
3. Actualiza lo que consuma el schema (tipos, schemas Zod, queries).
4. **No apliques** `pnpm db:push` ni `pnpm db:migrate`: están bajo permiso `ask`. Pide confirmación explícita y di a qué base apunta `DATABASE_URL` antes de correrlas.

Entrega: diff de la migración + evaluación de riesgos + plan de rollback.
