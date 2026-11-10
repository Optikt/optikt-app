---
description: Audita los cambios de dinero/tasas con el subagente money-reviewer
---

Usa el subagente `money-reviewer` para auditar los cambios actuales.

Contexto:

!`git status --short && git diff --stat`

Pásale el diff completo (`git diff`) y pídele hallazgos ordenados por severidad, cada uno con `archivo:línea`, escenario numérico y la prueba que lo demostraría.

Muéstrame el reporte antes de aplicar cualquier cambio.
