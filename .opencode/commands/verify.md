---
description: Corre el gate mínimo (svelte-check + eslint + vitest) sobre los cambios actuales
---

Verifica los cambios actuales con el gate mínimo del repo.

Estado del working copy:

!`git status --short`

Pasos:

1. Si la herramienta `optikt_verify` (namespace `optikt`) está disponible, úsala: es una sola llamada y devuelve PASS/FAIL por gate.
2. Si no está, corre manualmente:
   - `pnpm check`
   - `pnpm exec eslint <archivos .ts/.js/.svelte cambiados>`
   - `pnpm exec vitest --run --project=server` (añade `--project=client` si tocaste `.svelte`)

Reporta: gate → PASS/FAIL y, si falla, el **primer** error con `archivo:línea`.

No arregles nada todavía: primero dame el diagnóstico y qué propones.
