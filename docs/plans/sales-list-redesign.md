---
plan name: sales-list-redesign
plan description: Rediseño UI/UX del listado de ventas /sales: saldo protagonista, vistas Lista/Cuadros, filtros completos y acciones rápidas.
plan status: active
---

## Idea
Fuentes: prompt en /mnt/c/Users/victo/Downloads/prompt-redisenio-listado-ventas.md (v2) + mockup 'Ventas · listado · mockup.html' (fuente de verdad visual) + docs/sales-list-page.md (estado actual).
Decisiones cerradas con el usuario:
(1) Preferencia de vista por usuario -> NUEVA TABLA user_preferences (opcion C, no columna en users) + migracion y doc en docs/agents/users.md + mapping en scripts/agents-domains.json.
(2) KPIs (Por cobrar / Ventas del mes / Listas para retirar) son GLOBALES; lo filtrado va en el pie 'Seleccion: total - saldo'.
(3) Alinear >0 -> >0.01 en dashboard.ts y receivables.ts (tolerancia 0.01 del dominio).
(4) Conteos de pestañas FACETADOS (GROUP BY status con el WHERE sin filtro de estados).
(5) ?action= se implementa como patron agnostico y documentado para reusar en otras paginas (spec docs/specs/).
(6) customerId: fuera de alcance (parseo tolerante listo).
(7) Flags envio pendiente / item libre por fila: EXISTS correlacionados en el SELECT (sin JOIN).
(8) Eliminar SaleStatsCards (la linea <dl> no existe en el mockup; sus numeros quedan en KPI + pestañas).
Extra: sobrepago = WARNING en el form (no bloquea); moneda se queda con '$' (formatPrice actual); ?action=status en COMPLETED permitido solo para ADMIN (igualar al detalle).

## Implementation
- Fase 0 · Fundaciones: helper puro de saldo (saleBalance / hasBalance con epsilon 0.01, CANCELLED = no aplica) con specs; parseo tolerante de params nuevos de URL (view, sort, seller, from, to, balance, per) reutilizando parsePageParam/parseBooleanParam/setQueryParam/replaceUrlSearch; contenedor de pagina con container-type: inline-size; utilidades de motion con prefers-reduced-motion. Aceptacion: build limpio y enlaces antiguos (q, status, shippingPending, freeItem, cashea, page) identicos.
- Fase 1 · Datos: tabla user_preferences + migracion con /db y drizzle-guardian, doc en docs/agents/users.md y mapping en scripts/agents-domains.json; agregados nuevos (Por cobrar monto+count, total USD del mes, READY, resumen de seleccion) con COUNT/SUM ... FILTER en una sola query; filtro balance, orderBy 'balance', perPage expuesto en URL; EXISTS de flags por fila; alinear >0 -> >0.01 en dashboard.ts y receivables.ts. Aceptacion: un viaje por agregado, mismos WHERE/soft-delete que el listado, specs con ventas pagadas/parciales/sin abono/canceladas/completadas.
- Fase 2 · Cabecera, KPIs y filtros: SegmentedToggle Lista/Cuadros con tablist/aria-selected, 3 KPIs globales clicables (Por cobrar -> balance=1 + quita estados + ordena por saldo; Ventas del mes -> rango Este mes; Listas para retirar -> status=READY), barra de filtros (busqueda con lupa interior sin superponerse al placeholder y sin perder foco, vendedor, fecha con presets + datepicker, popover de switches, orden), pestañas de estado con conteos facetados, chips de filtros activos con X y 'Limpiar (n)'. Aceptacion: una sola fuente de verdad de filtros activos, todo cambio resetea a pagina 1, debounce 300ms, URL refleja todo y es compartible.
- Fase 3 · Vista Lista: grid de columnas 96|minmax(170px,1.5fr)|96|100|176|118|44 con columna Vendedor (150px) via @container (min-width:1130px) ocultando encabezado Y celdas por completo, celda de saldo protagonista (monto navy, barra 5px naranja warning, '% cobrado'; verde Pagado; cancelada con total tachado + barra discontinua + 'Cancelada - sin saldo' y fila atenuada al 60-65% sin atenuar pill ni menu), flags de envio/item, menu ⋯ navy 34x34 (Ver detalle / Registrar pago / Cambiar estado / Cancelar venta), pie (Mostrando 1-N de M, Seleccion total+saldo, selector 10/25/50, paginacion ventana 5), skeletons y EmptyState. Aceptacion: a 1280x720 con sidebar abierto se lee el saldo sin esfuerzo, sin nombres truncados, el ⋯ nunca salta de linea, y con sidebar cerrado no queda aislado con hueco enorme.
- Fase 4 · Vista Cuadros y componente de tarjeta unico: grid auto-fill minmax(250px,1fr), tarjeta con #/Cashea/pill/⋯ arriba, saldo grande 24/700, barra 6px, fila de flags solo si existen; el mismo componente alimenta el layout mobile y elimina la duplicacion row/mobileCard. Aceptacion: misma logica de presentacion en Cuadros y mobile, ninguna tarjeta con espacio muerto al fondo.
- Fase 5 · Preferencia de vista por perfil: remotes de user_preferences, lectura en el SSR del +page.server.ts de /sales, precedencia ?view= > perfil > 'list', guardado al cambiar con toast breve y fallback silencioso con reintento; VIEWER tambien puede guardarla; actualizar docs/agents/users.md y AGENTS.md del dominio. Aceptacion: cada perfil abre su vista sin parpadeo y un enlace con ?view= no pisa la preferencia guardada.
- Fase 6 · Acciones rapidas con ?action= como patron agnostico (spec docs/specs/ y mencion en AGENTS.md raiz): menu ⋯ navega a /sales/[id]?action=pay|status, el detalle consume el param una sola vez, valida permisos y estado (pay: rol cobrador + no cancelada + saldo >0.01; status: mismos guard que su boton, COMPLETED solo ADMIN) y lo elimina con replaceState; toast explicativo si no aplica; cancelar sigue abriendo CancelSaleModal desde el listado; ademas WARNING (no bloqueante) de sobrepago en el form de pago. Aceptacion: sin drawer de pago ni modal de estado copiados al listado, una recarga no reabre nada, el regreso conserva filtros/vista/pagina.
- Fase 7 · Pulido: tooltips propios (TriggerTooltip/InfoTooltip, nunca title), tokens (sin text-slate-400), transiciones 150-400ms cubic-bezier(.25,1,.5,1) con prefers-reduced-motion, accesibilidad (aria-pressed en pestanas, aria-live al cambiar vista/resultados, aria-current en paginacion, foco visible), imports directos sin barrel legacy, y revision visual 1280x720 (sidebar abierto y cerrado) + 1920x1080 contra el mockup.
- Docs en cada PR: sincronizar docs/agents/sales.md (endpoints nuevos, agregados, reglas) y docs/sales-list-page.md; correr tools.optikt.verify antes de cerrar cada fase.

## Required Specs
<!-- SPECS_START -->
- action-intent-param
<!-- SPECS_END -->
