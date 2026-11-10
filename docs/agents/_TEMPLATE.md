# <Dominio> (AGENTS.md de dominio)

> Ver root `AGENTS.md` para las reglas globales del repo (obligatorias para todos los dominios).
> Este documento solo agrega reglas de dominio. Regla de tamaño: ~80–150 líneas.
> El mapeo ruta→dominio vive en `scripts/agents-domains.json`; el check de CI avisa si este doc queda desincronizado con el código.

## Purpose

Qué hace el dominio en 2–5 líneas. Nada de marketing: el papel del dominio dentro del sistema.

## Scope

Rutas que cubre este doc (copiar de `scripts/agents-domains.json`). Todo lo demás afuera — si una regla aplica al repo entero, va en el root.

- `src/lib/components/<d>/**`
- `src/lib/remote/<d>/**`
- `src/lib/server/db/queries/<d>/**`
- ...

Owner rules (dominios que se tocan entre sí): quién es dueño de la invariant cuando dos dominios comparten una tabla/flujo (ej: pagos de venta viven en `sales` pero tocan `payments`).

## Reglas de dominio / invarianzas

Reglas de negocio **reales del código**, cada una con referencia a archivos (mínimo `path`):

- Regla 1 (`queries/votes.ts:12`).
- Regla 2. Estados y transiciones de status si existen.
- Reglas de dinero, inventario o destrucción de datos merecen ⚠️ si romperlas implica rollback/security.

## Patrones locales

Patrones que SOLO aplican aquí aunque difieran del resto del repo (y por qué). Si es el patrón general del root, NO está en este documento.

## Known gaps / tech debt

Bullets con severidad: 🟡 menor, 🟠 medio, 🔴 grave. Referencia a los plan/spec del repo en lugar de duplicarlos (`docs/plans/…`, `docs/specs/…`).

- 🟡 ...

## Testing

Convenciones locales de tests del dominio (ubique de specs, fixtures, con qué base están corriendo).
