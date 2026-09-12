# Spec: lens-print-tokens

Scope: feature

# Lens Print Tokens — PDF + Tickera

## Contrato

- `snapshotName` guarda nombre catálogo intacto (ej: `Nueva Vision - CRISTAL - CR39 · Convencional · FOTO · BLUE · Monofocal`).
- UI (`SaleItemsTable.svelte:96`) muestra `snapshotName` directo → siempre correcto.
- Impresión debe reconstruir vía `getPrintItemLabel` en `src/lib/utils/printDocumentItems.ts`:
  - Formato: `Cristal <Material> [<Tipo>] [Fotocromático] [AR] [Blueblock]`
  - Material: `CR-39`, `Policarbonato`, `Trivex`, `Hi-Index`, `Resina`, `Mineral`, fallback `Personalizado`.
  - Tipo: `Monofocal` omitido, `Progresivo`/`Bifocal`/`Ocupacional` incluidos.

## Tokens a detectar (case-insensitive, sin acento, por token `·`)

- FOTO: `foto` suelto, `fotocromat*`, `fotocrom*` → `Fotocromático`
- BLUE: `blue` suelto, `bluecut`, `blue cut`, `blue block`, `blueblock` → `Blueblock`
- AR: `ar` suelto, `antirreflejo`, `antireflejo`, `anti-reflejo` → `AR`
- Evitar falsos positivos: `ar` solo como token completo (`\bar\b`), no dentro de `claro`, `barrio`, etc. `blue` no debe exigir `cut/block`.

## Casos ventas prod

- #200: `CR39 · Convencional · FOTO · BLUE · Monofocal` → `Cristal CR-39 Fotocromático Blueblock`
- #199: `CR39 · Convencional · AR · BLUE · Progresivo` → `Cristal CR-39 Progresivo AR Blueblock`
- #206: `CR39 · FOTO · AR · Monofocal` → `Cristal CR-39 Fotocromático AR Blueblock` (si trae BLUE) o `Cristal CR-39 Fotocromático AR` (si no)
- Orden sufijos fijo: `Fotocromático` luego `AR` luego `Blueblock` para estabilidad snapshot.

## Alcance impresión

- PDF A4: `src/routes/(print)/print/sale/[id]/+page.svelte:282` usa `getPrintItemLabel`.
- Tickera: `src/lib/remote/printing.remote.ts:55 describeItem` usa `getPrintItemLabel` → `src/lib/shared/tickera.ts:147 description` passthrough.
- Fix único en `hasInherentDescriptor` cubre ambos. Prohibido duplicar lógica en `printing.remote.ts` o `tickera.ts`.

## Tests

- `src/lib/utils/printDocumentItems.spec.ts`: agregar `FOTO` solo, `BLUE` solo, `AR` solo, `FOTO+BLUE`, `AR+BLUE+Progresivo`, regresión forma larga `fotocromáticos antirreflejo`.
