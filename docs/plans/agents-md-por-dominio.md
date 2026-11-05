---
plan name: agents-md-por-dominio
plan description: AGENTS.md por dominio: índice machine-readable, plantilla, check CI y sembrado core
plan status: done
---

## Idea
Extender el AGENTS.md root con soporte de docs por dominio en docs/agents/<dominio>.md: reglas globales en root, reglas de dominio leídas antes de tocar ese dominio, índice determinista (scripts/agents-domains.json) y CI check warning-only de drift.

## Implementation
- Crear scripts/agents-domains.json (dominio -> globs) y validar contra git ls-files
- Crear docs/agents/_TEMPLATE.md con secciones fijas
- Extender root AGENTS.md: sección "AGENTS.md por dominio", boundaries de capas y Documentation Sync Rule + índice
- Crear scripts/check-agents-docs.mjs con selftest + paso warning-only en .github/workflows/lint.yml
- Sembrar docs core: sales, payments, receivables, purchases, cash, inventory, products, lenses, materials, customers, quotes

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->
