---
plan name: redesign-sale-detail-view
plan description: Rediseño completo de la vista de detalle de venta (/sales/[id]) según el prompt de implementación y el mockup detalle-venta-mockup-b.html, en 7 fases con gate al final de cada una.
plan status: done
---

## Idea
Fuente de verdad visual: docs/design/detalle-venta-mockup-b.html. Base funcional: docs/redesign-sale-view-prompt.md. Reglas de dinero verificadas: sin redondeo por línea, descuento global proporcional via computeAdjustedTaxBreakdown, tasa congelada por abono, snapshotBcvRate ya existe en el schema (Modo A disponible, resolveTicketRate resuelve A/B). Fuera de alcance: servidor de negocio, computeSaleTotals/computeAdjustedTaxBreakdown, gating de estados, EditSaleModal, PaymentRailSection interno, recibo/impresión.

## Implementation
- Fase 0 · Fundaciones: tokens de tinte si faltan, keyframes/utilidades de motion, contenedor de página con max-width 1280 + container query; extender findSaleByIdWithRelations con gender y address del cliente.
- Fase 1 · Hero navy: título en una línea con pill de estado y chip Cashea, stepper de estado, panel de cliente (avatar, enlace, chips copiables cédula/teléfono, edad/género/dirección opcionales), fila meta (Vendedor/Fecha/Tasa BCV con modo A/B), observaciones, barra inferior de acciones estirables (Cambiar estado ▾, Editar, Imprimir ▾, ⋯) y bloque de dinero (TOTAL + Bs + Desglose canónico colapsable + saldo con barra + CTA Cobrar alineado). Gating idéntico al actual.
- Fase 2 · Artículos: tabla con columnas chip/Artículo/USD/Bs./chevron sin columna Cant. (×N solo si >1), enlaces a fichas, fórmula colapsable con toda la fila clicable (role=button, aria-expanded, Enter/Espacio), tabla ESF/CIL/EJE/ADD + ALT/DP/DNP con aviso de montaje, tratamientos como filas hijas con conector, ítem libre pendiente, interruptor de Costos internos con chips de costo/margen y pie de tarjeta.
- Fase 3 · Pagos e historial: filas de pago con tasa congelada (@ NN,NN), anular con motivo obligatorio usando voidPayment existente, anulados ocultos con enlace Ver N anulados, tarjeta Historial con 3 eventos + Ver cambios (diff de changeHistory.changes) + drawer SlideOver 440px, pie con Movimientos de stock y última actualización.
- Fase 4 · Calculadora de factura: funciones puras con tests (desglose canónico, conversión a Bs con tasa elegida, líneas gravables/exentas, descuento proporcional, sin redondeo) + SlideOver 580px con selector de tasa (venta/actual/personalizada), tabla Concepto/Base/IVA/Total, chips copiables, Copiar resumen, avisos.
- Fase 5 · Tasa y estados: resolver Modo A/B con resolveTicketRate(sale.snapshotBcvRate, bcvRate), prefijo ≈ y marcas referenciales solo en Modo B, avisos (ítem libre pendiente, banda única de cancelación), y todos los estados de la §12 del prompt.
- Fase 6 · Pulido: transiciones con cubic-bezier(.25,1,.5,1), prefers-reduced-motion, accesibilidad (contraste, foco, Esc, aria-live), revisión a 1280x720 (sidebar abierto/cerrado) y 1920x1080 contra el mockup, limpieza de componentes obsoletos.
- Pruebas: unit (calculator, desglose, edad, visibilidad de campos opcionales, copias), componente (cambiar estado, anular pago, copiar, fórmula, interruptor costos, calculadora, rol solo lectura) y gate pnpm check + eslint al final de cada fase.

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->
