---
plan name: sales-list-mobile
plan description: Listado /sales en móvil + búsqueda global plegable en el shell (mockup ventas-listado-mobile)
plan status: active
---

## Idea
Soporte móvil para /sales y el shell global: barra 56px con búsqueda plegada en lupa, KPIs en carrusel, buscador sticky, hoja de filtros, vistas Lista/Cuadros distintas en móvil, hoja de acciones ⋯, FAB Nueva venta, paginación móvil. Fases del prompt docs/prompt-listado-ventas-mobile (reordenadas: kit antes que shell).

## Implementation
- Fase A (kit): extender SlideOver con direction=bottom ya existente para soportar asa+drag-to-close+safe-area; crear componentes compartidos del kit: carrusel scroll-snap con indicador, fila de píldoras desplazable, FAB extendido/contracción/ocultación. Specs co-ubicadas.
- Fase B (shell): AppNavbar <md — barra 56px una fila, búsqueda global plegada en icono de lupa (overlay con foco + panel ayuda/ejemplos + velo), reusar lógica de CommandSearch; menú lateral móvil con objetivos táctiles.
- Fase C (listado): cabecera móvil con selector de vista solo iconos + toast al guardar preferencia; KPIs en carrusel; buscador+Filtros sticky; pestañas de estado una fila con scroll; chips móviles.
- Fase D (listado): hoja de filtros bottom sheet (vendedor, fecha, mostrar solo, ordenar) con «Ver N ventas» conteo en vivo; aplicar a la URL igual que escritorio.
- Fase E (listado): tarjeta density compact|comfortable única (Lista densa vs Cuadros rica), hoja de acciones ⋯ como bottom sheet con mismo gating que SaleRowMenu (helper extraído), targets táctiles ≥44px.
- Fase F (listado): FAB Nueva venta (dorado, extendido/contracción/ocultación), pie móvil (resumen selección plegable + paginación prev/next), skeletons/estados, VIEWER sin FAB.
- Fase G: pulido — revisión 360/390/430, safe-areas, prefers-reduced-motion, atrás del sistema en hojas, verificación con gate (eslint+svelte-check+vitest) y revisión de dominio sales/shared docs.

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->
