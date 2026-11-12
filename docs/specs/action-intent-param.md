# Spec: action-intent-param

Scope: repo

# Patrón: intención de acción por query param (`?action=`)

> Patrón global (aplica a todas las rutas de detalle con acciones). Dueño: `shared` hasta que cada dominio lo adopte.
> Origen: rediseño de `/sales` (plan `sales-list-redesign`, fase 6).

## Problema

Una lista ofrece una acción que vive en el detalle (abrir el drawer de pago, el modal de estado, editar). Las alternativas malas son montar el componente en la lista (duplica carga, permisos y cableado) o pasarlo por store/`sessionStorage` (no es compartible, se pierde con recargas y atrás/adelante).

## Contrato

1. **La lista navega, el detalle ejecuta.** La acción se expresa como query param en la ruta de detalle: `/sales/<id>?action=pay`. El listado **nunca** monta el componente de la acción.
2. **Valores válidos por detalle, tipados y cerrados.** Cada ruta define su enumeración (en `/sales`: `pay` | `status`). Cualquier otro valor **se ignora** (parseo tolerante, igual que los filtros de URL).
3. **Sin datos en el param.** Solo la intención. Nunca montos, estados ni ids de terceros.
4. **Consumo único.** El detalle lo lee una sola vez, cuando la venta ya está cargada (`$effect` sobre datos ya presentes, o `onMount`), y acto seguido lo **elimina con `history.replaceState`** (helper `replaceUrlSearch` de `src/lib/utils/urlState.ts`). Así una recarga o el botón atrás no reabren el componente.
5. **El cliente no es la autoridad.** Antes de abrir, el detalle valida con **los mismos guard que sus propios botones** (rol + estado + ownership + saldo). Si no aplica: **no abre nada** y muestra un toast explicativo breve (ej. «Esta venta ya está pagada»). El servidor sigue validando de verdad al ejecutar la acción.
6. **Al regreso se conserva el contexto.** El listado sigue guardando su querystring en `sessionStorage` (`listReferrer:<ruta>`, ver `saveReferrerParams`/`getBackUrl` en `src/lib/utils/urlState.ts`), por lo que `?action=` no contamina el retorno: el detalle vuelve a `/sales` con sus filtros, vista y página.
7. **Tras ejecutar la acción, el usuario permanece en el detalle** (no se redirige al listado).

## Implementación mínima (a reutilizar)

- Parseo puro en el dominio compartido: `parseSaleAction(value): 'pay' | 'status' | null` (+ spec).
- Consumo en el detalle: un único `$effect` que lee el param, valida y limpia. Nunca dentro de un bloque reactivo que se re-ejecute por cambios de datos.
- Los guard de validación se reusan de los mismos helpers que alimentan los botones del detalle (no duplicar condiciones).

## Reglas

- No dejar `?action=` en la URL después de consumirlo.
- No confiar en él sin validar permisos y estado.
- No usarlo para acciones que la lista puede ejecutar por sí misma (ej. cancelar en `/sales` usa `CancelSaleModal` en la lista).
- Al añadirlo a otra página (quotes, purchases…), agregar valores a **su** enumeración y su spec; no generalizar el enumerado.

## Pruebas

- Unit: parseo (`pay`, `status`, valores inválidos, vacío, repetido).
- Componente: el detalle abre el componente correcto una vez y limpia la URL; segunda carga no reabre; con permisos/estado inválidos muestra toast y no abre; `getBackUrl` conserva filtros del listado.
