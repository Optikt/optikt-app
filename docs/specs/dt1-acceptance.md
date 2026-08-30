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

- [ ] Abrir pago desde detalle de venta (slide-over)
- [ ] Seleccionar cada método: PAGO_MOVIL_BS, TRANSFERENCIA_BS, PUNTO_VENTA_BS, EFECTIVO_BS, EFECTIVO_USD, EFECTIVO_EUR, BINANCE_USDT, PAYPAL
- [ ] ReferenceConfig correcto por método: label, required, placeholder, fallback `--`
- [ ] Monto nativo label/prefix correcto por método (Bs, $, €, USDT)
- [ ] Conversión BCV visible y correcta (tasa del día)
- [ ] Referencia obligatoria bloquea submit cuando `required`
- [ ] Pago exitoso → balance actualizado, toast, sale status cambia si saldada
- [ ] Pago parcial → pendingAmount correcto
- [ ] Void de pago → saldo restaurado, audit log registra
- [ ] Cierre sin submit → cero side effects

### F2 · Pago de compra (PurchasePaymentAdapter)

- [ ] Registrar pago con cada medio (PAGO_MOVIL_BS, TRANSFERENCIA_BS, EFECTIVO_USD, BINANCE_USDT, OTRO)
- [ ] Abono explícito en moneda de deuda (USD-BCV, USDT, EUR, Bs) correcto
- [ ] Pronto pago / early payment benefit cálculo correcto
- [ ] Crédito: saldo deuda y vencimientos actualizados
- [ ] Void pago → crédito restaurado
- [ ] Orden multi-moneda (USDT/EUR) sin conversión errónea a USD-BCV

### F3 · Wizard de venta (saleItemHelpers splits)

- [ ] Crear venta completa: producto + lente + item gratis
- [ ] Step 2: confirmación prescripción OD/OI, range warnings, sugerencia tipo lente
- [ ] Descuentos por item y globales correctos
- [ ] Tax breakdown y totales idénticos a antes del split
- [ ] Autosync tipo de lente al confirmar

### F4 · EditSaleModal

- [ ] Editar ítems existentes (producto, lente, tratamiento, gratis)
- [ ] Agregar/remover ítems, editar lente con tratamientos
- [ ] Preview subtotal/descuento/total reactivo
- [ ] Guardar → updateSale con reason, audit
- [ ] Cancelar → cero cambios

### F5 · LensCatalogForm

- [ ] Crear lente nuevo con ranges ópticos (sphere/cylinder por modo)
- [ ] Auto-name, supplier/materials/technologies, pending entities
- [ ] Validaciones de rangos server + client
- [ ] Editar lente existente → prefill correcto
- [ ] Live pricing (pair purchase price, operational cost, margin)

### F6 · Conteo de inventario (inventory/count)

- [ ] Crear sesión (ALL / PRODUCT_CATEGORY / LENS)
- [ ] Detalle sesión: filtros (ALL/COUNTED/PENDING/WITH_DIFF), búsqueda
- [ ] Editar línea inline, guardar countedStock, diferencias calculadas
- [ ] Ajuste completado toggle por línea
- [ ] Aplicar sesión → movimientos y stock actualizados
- [ ] Cancelar sesión con razón

### F7 · Páginas detalle (customers/[id], sales/[id], quotes/[id], lenses/[id], purchases/[id])

- [ ] Carga de datos correcta (load)
- [ ] Tabs/paneles navegables
- [ ] Acciones CRUD funcionan post-split
- [ ] Estados loading/empty/error sin regresión

### F8 · Caja y gastos (cash, cash/expenses)

- [ ] Lista gastos, filtros
- [ ] Crear/void gasto con conversión BCV
- [ ] Reporte de caja y daily breakdown correctos
- [ ] Pipeline snapshot correcto

### F9 · Remotes server (post-split barrels)

- [ ] `pnpm check` 0 errores (imports resueltos vía barrels)
- [ ] Cada remote function ejecuta en dev: query + command por dominio
- [ ] Zero imports legacy rotos (rg por ruta vieja)

## Criterio de aceptación global DT1

- Todos los checklists de flujos tocados ✅
- Gates técnicos verdes (check/lint/test) + size gate bloqueante
- Cero archivos fuente >500 líneas, módulos nuevos ≤300
- PLAN.md DT1 marcado ✅ con stats finales