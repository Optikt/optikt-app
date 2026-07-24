# Plan: Rediseño del Paso 1 (Información) — Wizard de Nueva Compra

## Resumen Ejecutivo

Rediseñar el Paso 1 del wizard de nueva compra para consolidar 4 cards en 2 cards, implementar container queries para responsividad interna, y mejorar la UX con revelación progresiva y transiciones suaves.

**Estado:** Planificación (requiere aprobación del usuario)

---

## 1. Objetivos del Rediseño

### Problemas Actuales
- **Fragmentación excesiva:** 4 cards separadas crean confusión visual
- **Side-effects cruzados:** Cambios en una card provocan reflow en otra
- **Responsividad limitada:** Los campos internos no responden al ancho de la card
- **UX inconsistente:** Base de precios usa SegmentedToggle (no escala bien), moneda de obligación siempre visible

### Objetivos
1. **Consolidar en 2 cards:** Documento+Pago | Finanzas+Descuento
2. **Container queries:** Campos internos responden al ancho de la card, no del viewport
3. **Revelación progresiva:** Campos avanzados ocultos por defecto
4. **Transiciones suaves:** Sin saltos visuales al cambiar estados
5. **Drawer mejorado:** Right-side en desktop, bottom-sheet en mobile

---

## 2. Cambios Clave vs Implementación Actual

| Aspecto | Actual | Propuesto |
|---------|--------|-----------|
| **Layout** | 2 cards en `lg:grid-cols-2` | 2 cards en `lg:grid-cols-2` + `max-w-[1400px]` |
| **Responsividad interna** | Media queries (viewport) | Container queries (ancho de card) |
| **Base de precios** | SegmentedToggle (5 opciones) | `<select>` nativo |
| **Moneda de obligación** | Siempre visible | Oculta, revelada via checkbox |
| **Condición de pago** | Info text en Contado | Sin info text, solo summary en Crédito |
| **Drawer crédito** | Solo right-side | Right-side (desktop) + bottom-sheet (mobile) |
| **Descuento** | Valor+nota siempre visibles | Condicionales según tipo |
| **Componentes** | 3 panels separados | 2 card components + drawer |

---

## 3. Arquitectura de Componentes

### Estructura de Archivos
```
src/lib/components/purchases/step1/
  ├── PurchaseOrderStep1.svelte          # Orquestador (grid + action bar)
  ├── PurchaseOrderStep1Card1.svelte     # "Documento y condición de pago"
  ├── PurchaseOrderStep1Card2.svelte     # "Datos financieros y descuento"
  ├── PurchaseOrderCreditDrawer.svelte   # Drawer de condiciones de crédito
  └── FieldWrapper.svelte                # Wrapper reutilizable (label + input)
```

### Componentes a Deprecar
- `PurchaseOrderDocumentPanel.svelte` → lógica movida a Card1
- `PurchaseOrderPaymentTermsPanel.svelte` → lógica movida a Card1 + Drawer
- `PurchaseOrderDiscountPanel.svelte` → lógica movida a Card2

**Justificación:** Estos 3 panels son usados **exclusivamente** en el wizard (verificado via grep). No se usan en páginas de detalle/edición.

### Componentes a Modificar
- `NewPurchaseOrderForm.svelte` — usar `PurchaseOrderStep1` en lugar de renderizar cards inline
- `SlideOver.svelte` — agregar prop `direction` para soportar bottom-sheet en mobile

### Componentes a Crear
- `FieldWrapper.svelte` — wrapper genérico con label, required indicator, error state
- `PurchaseOrderStep1.svelte` — orquestador del Paso 1
- `PurchaseOrderStep1Card1.svelte` — Card 1
- `PurchaseOrderStep1Card2.svelte` — Card 2
- `PurchaseOrderCreditDrawer.svelte` — drawer de crédito

---

## 4. Especificaciones Detalladas

### 4.1 FieldWrapper.svelte

**Props:**
```typescript
interface Props {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  class?: string;
  children: Snippet;
}
```

**Estructura:**
```svelte
<div class="space-y-1.5 {className}">
  <label class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
    {label}
    {#if required}<span class="text-error">*</span>{/if}
  </label>
  {@render children()}
  {#if error}
    <p class="text-xs text-error">{error}</p>
  {/if}
  {#if hint}
    <p class="text-xs text-on-surface-variant">{hint}</p>
  {/if}
</div>
```

**Estilos:** Usa `purchaseFieldStyles.inputClass` para inputs internos.

---

### 4.2 PurchaseOrderStep1.svelte (Orquestador)

**Responsabilidades:**
- Renderizar header (breadcrumb + stepper)
- Renderizar 2 cards en grid responsive
- Renderizar action bar (Cancelar + Siguiente)
- Gestionar estado global del Paso 1

**Layout:**
```svelte
<div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Header -->
  <WizardHeader {steps} {currentStep} ... />
  
  <!-- Content -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8 mt-6 items-start">
    <PurchaseOrderStep1Card1 bind:supplierId bind:documentType ... />
    <PurchaseOrderStep1Card2 bind:sourceCurrency bind:bcvRate ... />
  </div>
  
  <!-- Action Bar -->
  <div class="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-outline-variant/20">
    <button onclick={goBack} class="...">Cancelar</button>
    <button onclick={handleNext} disabled={!canNext} class="...">Siguiente →</button>
  </div>
</div>
```

**Validación:**
```typescript
const canNext = $derived(
  supplierId &&
  orderDate &&
  bcvRate > 0 &&
  notes.trim().length >= 6 &&
  settlementCurrency &&
  (paymentTerms !== 'CREDIT' || creditDueDate) // si es crédito, requiere fecha
);
```

---

### 4.3 PurchaseOrderStep1Card1.svelte

**Título:** "Documento y condición de pago" (sin subtítulo)

**Estructura:**
```svelte
<div class="@container rounded-2xl bg-surface-container-low p-6 ring-1 ring-outline-variant/20">
  <h2 class="text-lg font-heading font-semibold text-brand-navy mb-6">
    Documento y condición de pago
  </h2>
  
  <!-- Proveedor (full width) -->
  <FieldWrapper label="Proveedor" required>
    <SelectInput bind:value={supplierId} options={suppliers} placeholder="Buscar proveedor..." />
  </FieldWrapper>
  
  <!-- Secondary fields (container query grid) -->
  <div class="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-4 mt-4">
    <FieldWrapper label="Tipo de documento">
      <SegmentedToggle value={documentType} options={[...]} onchange={...} />
    </FieldWrapper>
    <FieldWrapper label="N° factura">
      <input type="text" bind:value={invoiceNumber} placeholder="Opcional" />
    </FieldWrapper>
    <FieldWrapper label="Fecha de orden">
      <input type="date" bind:value={orderDate} />
    </FieldWrapper>
  </div>
  
  <!-- Observaciones (full width) -->
  <FieldWrapper label="Observaciones" required class="mt-4">
    <textarea bind:value={notes} rows="3" placeholder="Observaciones internas..." />
  </FieldWrapper>
  
  <!-- Divider -->
  <hr class="border-outline-variant/20 my-6" />
  
  <!-- Condición de pago -->
  <div class="flex items-center gap-3">
    <SegmentedToggle value={paymentTerms} options={[Contado, Crédito]} onchange={...} />
    <button onclick={openCreditDrawer} disabled={paymentTerms === 'CONTADO'} title="Configurar crédito">
      <Settings class="h-5 w-5" />
    </button>
  </div>
  
  <!-- Crédito summary or hint -->
  {#if paymentTerms === 'CREDIT'}
    {#if creditConfigured}
      <p class="text-sm text-on-surface-variant mt-2">
        Vence el {formatDate(creditDueDate)} · Pronto pago {earlyPaymentPercent}% antes del {formatDate(earlyPaymentDeadline)}
      </p>
    {:else}
      <p class="text-sm text-on-surface-variant mt-2">
        Configura las condiciones del crédito
      </p>
    {/if}
  {/if}
</div>
```

**Container Queries:**
- `@container` en el wrapper de la card
- `@md:grid-cols-2` para campos secundarios cuando card >= 448px
- `@xl:grid-cols-3` para campos secundarios cuando card >= 672px

---

### 4.4 PurchaseOrderStep1Card2.svelte

**Título:** "Datos financieros" (sin subtítulo)

**Estructura:**
```svelte
<div class="@container rounded-2xl bg-surface-container-low p-6 ring-1 ring-outline-variant/20">
  <h2 class="text-lg font-heading font-semibold text-brand-navy mb-6">
    Datos financieros
  </h2>
  
  <!-- Base de precios (SELECT) -->
  <FieldWrapper label="Base de precios">
    <select bind:value={sourceCurrency} class="...">
      <option value="USD_BCV">USD (BCV)</option>
      <option value="VES">Bolívares</option>
      <option value="EUR_BCV">Euro (€)</option>
      <option value="USDT">USDT</option>
      <option value="USD_PAYPAL">USD (PayPal)</option>
    </select>
  </FieldWrapper>
  
  <!-- Conditional rates -->
  <div class="grid grid-cols-1 @md:grid-cols-2 gap-4 mt-4">
    <FieldWrapper label="Tasa USD BCV/Bs" required>
      <input type="number" bind:value={bcvRate} placeholder="0" step="0.01" />
    </FieldWrapper>
    {#if needsAltRate}
      <FieldWrapper label="Tasa {altCurrencyLabel}/Bs" required>
        <input type="number" bind:value={sourceRateToVes} placeholder="0" step="0.01" />
      </FieldWrapper>
    {/if}
  </div>
  
  <!-- Moneda de obligación (hidden by default) -->
  <label class="flex items-center gap-2 mt-4 cursor-pointer">
    <input type="checkbox" bind:checked={settlementManuallyChanged} class="..." />
    <span class="text-sm text-on-surface-variant">
      El proveedor cobra en una moneda distinta a la del documento
    </span>
  </label>
  {#if settlementManuallyChanged}
    <FieldWrapper label="Moneda de obligación" class="mt-3">
      <select bind:value={settlementCurrency} class="...">
        <!-- same options as base -->
      </select>
    </FieldWrapper>
  {/if}
  
  <!-- Divider -->
  <hr class="border-outline-variant/20 my-6" />
  
  <!-- Descuento -->
  <FieldWrapper label="Tipo de descuento">
    <SegmentedToggle value={discountType} options={[Sin, Porcentaje, Monto]} onchange={...} />
  </FieldWrapper>
  
  {#if discountType !== 'NONE'}
    <div class="grid grid-cols-1 @md:grid-cols-2 gap-4 mt-4">
      <FieldWrapper label="Valor del descuento">
        <input type="number" bind:value={discountValue} placeholder="0" step="0.01" />
      </FieldWrapper>
      <FieldWrapper label="Nota del descuento">
        <input type="text" bind:value={discountNotes} placeholder="Motivo o referencia (opcional)" />
      </FieldWrapper>
    </div>
  {/if}
</div>
```

**Lógica Condicional:**
- `needsAltRate = sourceCurrency !== 'USD_BCV' && sourceCurrency !== 'VES'`
- `altCurrencyLabel` = 'EUR', 'USDT', o 'USD PayPal' según `sourceCurrency`
- Si `settlementManuallyChanged = false`, `settlementCurrency` sigue automáticamente a `sourceCurrency`

---

### 4.5 PurchaseOrderCreditDrawer.svelte

**Responsabilidades:**
- Drawer para configurar condiciones de crédito
- Right-side en desktop, bottom-sheet en mobile
- Validación de campos requeridos

**Estructura:**
```svelte
<SlideOver bind:open={drawerOpen} direction={isMobile ? 'bottom' : 'right'} size="md">
  <h2 class="text-lg font-heading font-semibold text-brand-navy mb-6">
    Condiciones del crédito
  </h2>
  
  <FieldWrapper label="Fecha de vencimiento del crédito" required>
    <input type="date" bind:value={creditDueDate} />
  </FieldWrapper>
  
  <label class="flex items-center gap-2 mt-4 cursor-pointer">
    <input type="checkbox" bind:checked={hasEarlyPayment} class="..." />
    <span class="text-sm font-medium">Beneficio de pronto pago</span>
  </label>
  
  {#if hasEarlyPayment}
    <div class="grid grid-cols-2 gap-4 mt-4 transition-all duration-200">
      <FieldWrapper label="Fecha máxima para pronto pago">
        <input type="date" bind:value={earlyPaymentDeadline} />
      </FieldWrapper>
      <FieldWrapper label="% de beneficio">
        <input type="number" bind:value={earlyPaymentPercent} placeholder="0" min="0" max="100" />
      </FieldWrapper>
    </div>
    <p class="text-xs text-on-surface-variant mt-2">
      Pagar antes de la fecha máxima aplica el % de descuento sobre el total
    </p>
  {/if}
  
  <div class="flex gap-3 mt-6">
    <button onclick={cancelDrawer} class="flex-1 ...">Cancelar</button>
    <button onclick={saveDrawer} class="flex-1 ..." disabled={!canSave}>Guardar condiciones</button>
  </div>
</SlideOver>
```

**Validación:**
```typescript
const canSave = $derived(
  creditDueDate &&
  (!hasEarlyPayment || (earlyPaymentDeadline && earlyPaymentPercent > 0))
);
```

**Mobile Detection:**
```typescript
const isMobile = $derived(window.innerWidth < 768); // md breakpoint
```

---

### 4.6 SlideOver.svelte (Modificación)

**Cambio:** Agregar prop `direction` para soportar bottom-sheet en mobile.

**Props actualizados:**
```typescript
interface Props {
  open: boolean;
  onclose?: () => void;
  size?: 'md' | 'lg' | 'xl';
  direction?: 'right' | 'bottom'; // NUEVO
  children: Snippet;
  header?: Snippet<[{ onclose: () => void }]>;
  footer?: Snippet;
}
```

**Implementación:**
```svelte
{#if direction === 'bottom'}
  <!-- Bottom sheet -->
  <div class="fixed inset-x-0 bottom-0 max-h-[90vh] ...">
    <div class="translate-y-full ... transition-transform">
      <!-- content -->
    </div>
  </div>
{:else}
  <!-- Right side (existing) -->
  <div class="fixed top-0 right-0 h-full ...">
    <div class="translate-x-full ... transition-transform">
      <!-- content -->
    </div>
  </div>
{/if}
```

---

## 5. Fases de Implementación

### Fase 1: Setup y Componentes Reutilizables
1. Crear directorio `src/lib/components/purchases/step1/`
2. Crear `FieldWrapper.svelte`
3. Modificar `SlideOver.svelte` para agregar prop `direction`

### Fase 2: Card 1 (Documento y condición de pago)
1. Crear `PurchaseOrderStep1Card1.svelte`
2. Implementar Proveedor select (full width)
3. Implementar grid de campos secundarios con container queries
4. Implementar Observaciones textarea
5. Implementar Condición de pago segmented + gear button
6. Implementar summary/hint de crédito

### Fase 3: Drawer de Crédito
1. Crear `PurchaseOrderCreditDrawer.svelte`
2. Implementar fecha de vencimiento (required)
3. Implementar checkbox "Beneficio de pronto pago"
4. Implementar campos condicionales (fecha máxima + %)
5. Implementar validación y footer (Cancelar + Guardar)
6. Wire up open/close desde Card 1

### Fase 4: Card 2 (Datos financieros y descuento)
1. Crear `PurchaseOrderStep1Card2.svelte`
2. Implementar Base de precios SELECT
3. Implementar lógica condicional de tasas (1 o 2 inputs)
4. Implementar checkbox "Moneda de obligación distinta"
5. Implementar select de moneda de obligación (condicional)
6. Implementar Descuento segmented + campos condicionales

### Fase 5: Orquestador
1. Crear `PurchaseOrderStep1.svelte`
2. Renderizar Card 1 y Card 2 en grid de 2 columnas
3. Agregar action bar (Cancelar + Siguiente)
4. Wire up state desde parent

### Fase 6: Integración
1. Actualizar `NewPurchaseOrderForm.svelte` para usar `PurchaseOrderStep1`
2. Eliminar imports de panels deprecados
3. Probar comportamiento responsive (mobile, tablet, desktop)
4. Probar container queries (card angosta vs ancha)
5. Probar drawer (desktop right, mobile bottom)
6. Probar lógica condicional (Contado/Crédito, tasas, descuento)

### Fase 7: Pulido
1. Agregar transiciones suaves para secciones condicionales
2. Asegurar accesibilidad (labels, focus, keyboard nav)
3. Probar edge cases (estados vacíos, validación)
4. Optimizar performance

---

## 6. Preguntas para el Usuario

### 6.1 Container Queries
**Contexto:** El proyecto usa Tailwind v4.3.2 pero **no tiene container queries configurados**. El plugin `@tailwindcss/container-queries` no está instalado.

**Opciones:**
1. **Agregar el plugin** — Instalar `@tailwindcss/container-queries` y configurarlo en `layout.css`
2. **Usar media queries** — Mantener responsividad basada en viewport (más simple, menos preciso)
3. **Híbrido** — Media queries para layout macro, container queries solo para grids internos de cards

**Recomendación:** Opción 1 (agregar plugin) para máxima flexibilidad.

### 6.2 Drawer Mobile (Bottom Sheet)
**Contexto:** `SlideOver.svelte` solo soporta deslizamiento desde la derecha. No tiene prop `direction`.

**Opciones:**
1. **Modificar SlideOver** — Agregar prop `direction` para soportar `right` y `bottom`
2. **Crear BottomSheet component** — Componente separado para mobile
3. **CSS media queries** — Usar `@media (max-width: 768px)` para cambiar transform direction

**Recomendación:** Opción 1 (modificar SlideOver) para reutilización.

### 6.3 Base de Precios: SELECT vs SegmentedToggle
**Contexto:** El spec pide reemplazar el SegmentedToggle con un `<select>` nativo.

**Consideraciones:**
- SELECT es más accesible (keyboard nav nativo)
- SELECT escala mejor con muchas opciones
- SegmentedToggle es más visual pero ocupa más espacio

**Pregunta:** ¿Confirmas que quieres SELECT nativo en lugar de SegmentedToggle?

### 6.4 Moneda de Obligación Oculta
**Contexto:** El spec pide ocultar este campo detrás de un checkbox.

**Consideraciones:**
- Reduce carga visual (campo avanzado)
- Puede confundir a usuarios que no saben que existe
- El valor sigue enviándose al backend incluso cuando está oculto

**Pregunta:** ¿Quieres agregar un tooltip o hint explicando cuándo usar este campo?

### 6.5 Deprecación de Panels Existentes
**Contexto:** Los 3 panels (DocumentPanel, PaymentTermsPanel, DiscountPanel) son usados **exclusivamente** en el wizard.

**Opciones:**
1. **Deprecar y eliminar** — Mover lógica a nuevos card components, eliminar archivos
2. **Mantener como legacy** — Dejar archivos pero no usarlos (por si se necesitan en el futuro)
3. **Refactorizar** — Mantener panels pero simplificarlos para uso interno en cards

**Recomendación:** Opción 1 (deprecar y eliminar) para reducir deuda técnica.

---

## 7. Estimación de Esfuerzo

| Fase | Tareas | Estimación |
|------|--------|------------|
| 1. Setup | FieldWrapper, SlideOver modification | 1-2 horas |
| 2. Card 1 | Document + Pago fields | 2-3 horas |
| 3. Drawer | Credit conditions drawer | 2-3 horas |
| 4. Card 2 | Financial + Discount fields | 2-3 horas |
| 5. Orquestador | Step 1 component + action bar | 1 hora |
| 6. Integración | Wire up + testing | 2-3 horas |
| 7. Pulido | Transitions, a11y, edge cases | 2-3 horas |
| **Total** | | **12-18 horas** |

---

## 8. Criterios de Aceptación

### Funcionalidad
- [ ] Paso 1 renderiza 2 cards en grid de 2 columnas (desktop)
- [ ] Cards se apilan en 1 columna (mobile)
- [ ] Campos internos responden al ancho de la card (container queries)
- [ ] Base de precios usa SELECT nativo
- [ ] Moneda de obligación oculta por defecto, revelada via checkbox
- [ ] Condición de pago muestra summary en Crédito, nada en Contado
- [ ] Drawer de crédito abre desde derecha (desktop) o abajo (mobile)
- [ ] Descuento muestra campos condicionales según tipo
- [ ] Validación previene avanzar sin campos requeridos

### UX
- [ ] Sin side-effects visuales cruzados entre cards
- [ ] Transiciones suaves para secciones condicionales
- [ ] Proveedor siempre full width
- [ ] Observaciones siempre full width
- [ ] Action bar siempre visible al fondo
- [ ] Drawer con foco atrapado y cierre por Escape

### Accesibilidad
- [ ] Todos los inputs tienen labels asociados
- [ ] Campos requeridos marcados con `*`
- [ ] Segmented controls navegables por teclado
- [ ] Drawer cierra con Escape
- [ ] Focus visible en todos los elementos interactivos

### Responsive
- [ ] Mobile (< 768px): cards apiladas, drawer bottom-sheet
- [ ] Tablet (768px - 1024px): cards apiladas o 2 columnas según espacio
- [ ] Desktop (>= 1024px): 2 columnas, drawer right-side
- [ ] Container queries: campos internos responden al ancho de card

---

## 9. Notas Técnicas

### Container Queries en Tailwind v4
```css
/* En layout.css */
@plugin "@tailwindcss/container-queries";
```

```svelte
<!-- Uso -->
<div class="@container">
  <div class="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
    <!-- fields -->
  </div>
</div>
```

### Transiciones Suaves
```svelte
{#if condition}
  <div class="transition-all duration-200 ease-in-out">
    <!-- conditional content -->
  </div>
{/if}
```

### Bottom Sheet en Mobile
```svelte
<SlideOver bind:open={drawerOpen} direction={isMobile ? 'bottom' : 'right'}>
  <!-- content -->
</SlideOver>
```

---

## 10. Próximos Pasos

1. **Revisar este plan** con el usuario
2. **Responder preguntas** (container queries, drawer mobile, SELECT vs SegmentedToggle, etc.)
3. **Aprobar plan** para proceder con implementación
4. **Implementar Fase 1** (setup + componentes reutilizables)
5. **Iterar** por fases con feedback continuo

---

**Documento creado:** 2026-01-24  
**Última actualización:** 2026-01-24  
**Estado:** Pendiente de aprobación
