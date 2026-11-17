> **Estado:** DONE — trabajo merged; casillas cerradas retroactivamente (verificación 2026-11-17). Spec de aceptación histórica.

# Spec: dt1-acceptance

Scope: feature

# DT1 · Spec de Aceptación (QA anti-regresión)

## Objetivo

Cada PR de descomposición DT1 es refactor puro → riesgo de regresión invisible en UI/UX. Esta spec define el checklist QA manual obligatorio por flujo tocado, antes de merge. Complementa los gates técnicos del protocolo (check/lint/test).

## Metodología

- Checklist ejecutado manualmente en dev o preview por cada PR.
- Evidencia: nota en el PR marcando cada item ✅/❌ + screenshot si toca UI.
- Item crítico fallado → bloquea merge, fix en misma rama.
- Items "N/A" permitidos solo si el PR no toca el flujo.
- PR de migración de imports (mecánico) → ejecutar checklist del flujo del archivo tocado.

## Checklists por flujo

### F1 · Pago de venta (PaymentForm, PaymentSubmission, SalePaymentAdapter)

- [x] Abrir pago desde detalle de venta (slide-over)
- [x] Seleccionar cada método: PAGO_MOVIL_BS, TRANSFERENCIA_BS, PUNTO_VENTA_BS, EFECTIVO_BS, EFECTIVO_USD, EFECTIVO_EUR, BINANCE_USDT, PAYPAL
- [x] ReferenceConfig correcto por método: label, required, placeholder, fallback `--`
- [x] Monto nativo label/prefix correcto por método (Bs, $, €, USDT)
- [x] Conversión BCV visible y correcta (tasa del día)
- [x] Referencia obligatoria bloquea submit cuando `required`
- [x] Pago exitoso → balance actualizado, toast, sale status cambia si saldada
- [x] Pago parcial → pendingAmount correcto
- [x] Void de pago → saldo restaurado, audit log registra
- [x] Cierre sin submit → cero side effects

### F2 · Pago de compra (PurchasePaymentAdapter)

- [x] Registrar pago con cada medio (PAGO_MOVIL_BS, TRANSFERENCIA_BS, EFECTIVO_USD, BINANCE_USDT, OTRO)
- [x] Abono explícito en moneda de deuda (USD-BCV, USDT, EUR, Bs) correcto
- [x] Pronto pago / early payment benefit cálculo correcto
- [x] Crédito: saldo deuda y vencimientos actualizados
- [x] Void pago → crédito restaurado
- [x] Orden multi-moneda (USDT/EUR) sin conversión errónea a USD-BCV

### F3 · Wizard de venta (saleItemHelpers splits)

- [x] Crear venta completa: producto + lente + item gratis
- [x] Step 2: confirmación prescripción OD/OI, range warnings, sugerencia tipo lente
- [x] Descuentos por item y globales correctos
- [x] Tax breakdown y totales idénticos a antes del split
- [x] Autosync tipo de lente al confirmar

### F4 · EditSaleModal

- [x] Editar ítems existentes (producto, lente, tratamiento, gratis)
- [x] Agregar/remover ítems, editar lente con tratamientos
- [x] Preview subtotal/descuento/total reactivo
- [x] Guardar → updateSale con reason, audit
- [x] Cancelar → cero cambios

### F5 · LensCatalogForm

- [x] Crear lente nuevo con ranges ópticos (sphere/cylinder por modo)
- [x] Auto-name, supplier/materials/technologies, pending entities
- [x] Validaciones de rangos server + client
- [x] Editar lente existente → prefill correcto
- [x] Live pricing (pair purchase price, operational cost, margin)

### F6 · Conteo de inventario (inventory/count)

- [x] Crear sesión (ALL / PRODUCT_CATEGORY / LENS)
- [x] Detalle sesión: filtros (ALL/COUNTED/PENDING/WITH_DIFF), búsqueda
- [x] Editar línea inline, guardar countedStock, diferencias calculadas
- [x] Ajuste completado toggle por línea
- [x] Aplicar sesión → movimientos y stock actualizados
- [x] Cancelar sesión con razón

### F7 · Páginas detalle (customers/[id], sales/[id], quotes/[id], lenses/[id], purchases/[id])

- [x] Carga de datos correcta (load)
- [x] Tabs/paneles navegables
- [x] Acciones CRUD funcionan post-split
- [x] Estados loading/empty/error sin regresión

### F8 · Caja y gastos (cash, cash/expenses)

- [x] Lista gastos, filtros
- [x] Crear/void gasto con conversión BCV
- [x] Reporte de caja y daily breakdown correctos
- [x] Pipeline snapshot correcto

### F9 · Remotes server (post-split barrels)

- [x] `pnpm check` 0 errores (imports resueltos vía barrels)
- [x] Cada remote function ejecuta en dev: query + command por dominio
- [x] Zero imports legacy rotos (rg por ruta vieja)

## Criterio de aceptación global DT1

- Todos los checklists de flujos tocados ✅
- Gates técnicos verdes (check/lint/test) + size gate bloqueante
- Cero archivos fuente >500 líneas, módulos nuevos ≤300
- PLAN.md DT1 marcado ✅ con stats finales
