# Prompt para Code Agent — Rediseño del drawer "Modificar orden" (SvelteKit)

Copia y pega esto a tu code agent:

---

## Rol y objetivo

Eres un desarrollador frontend senior especializado en UI de producto. Refactoriza el drawer/modal de **"Modificar orden"** de nuestra app de gestión de óptica (SvelteKit + TypeScript). El UI actual tiene cards anidadas dentro de cards, espacio desaprovechado y forms que aparecen como bloques separados del ítem que editan.

**Referencia visual obligatoria:** abre `redesign-drawer-modificar-orden.html` (mockup interactivo) y reprodúcelo con fidelidad. Ese archivo es la fuente de verdad del diseño.

## Problemas del UI actual (a eliminar)

1. Cards dentro de cards: la sección "Artículos" es una card que contiene una card por ítem, y el form de edición es otra card más flotando por encima.
2. Formulario de edición desacoplado: al editar un cristal aparece un bloque "Cristal y precio" + "Receta óptica" en cards separadas, lejos del ítem de la lista.
3. Espacio desaprovechado: paddings/bordes/sombras acumulados en cada nivel de anidación.
4. El resumen (subtotal/total) y el motivo de modificación compiten visualmente sin jerarquía.

## Diseño objetivo

### Anatomía del drawer (columna flex, ancho 680px, full-height, derecho)

```
┌──────────────────────────────────────────────────┐
│ HEADER (fijo): "Modificar orden" + badge #0265 + X│  60px
│ META BAR (fijo): [Fecha] [Cliente] [Nota]         │  ~56px, fondo gris-50
├──────────────────────────────────────────────────┤
│ BODY (scroll):                                    │
│   ARTÍCULOS (n)          ← label de sección       │
│   ── fila de artículo (divisor 1px, sin card)    │
│   ── fila de artículo                            │
│      └─ editor inline expandido (acordeón)        │
│   ┌╌╌╌╌ Agregar artículo ╌╌╌╌┐ ← botón punteado  │
│   └── menú: Cristal / Producto / Ítem libre ──┘  │
├──────────────────────────────────────────────────┤
│ FOOTER (fijo): Resumen + Descuento orden          │
│   Motivo de modificación (textarea)               │
│   [Cancelar] [Guardar cambios]                    │
└──────────────────────────────────────────────────┘
```

### Reglas de diseño (NO negociables)

1. **Cero cards anidadas.** La lista de artículos es plana: filas separadas por hairlines de 1px (`--slate-200`). Máximo 2 niveles de superficie: drawer blanco → editor gris-50. Nunca 3.
2. **Edición inline tipo acordeón.** Click en la fila (o en el lápiz) expande el editor DEBAJO de esa fila, con fondo `slate-50` y una barra lateral de 3px en color acento. Solo UN editor abierto a la vez (cerrar los demás). El editor tiene botón "Hecho ✓" para colapsarlo.
3. **Fila de artículo (~64px):** `[icon-chip 40px por tipo] [nombre + meta] [×qty] [−descuento] [total] [lápiz|papelera al hover]`. El icon-chip cambia de color según tipo: cristal=violeta, producto=azul, ítem libre=ámbar. Meta line con tag del tipo (CRISTAL/PRODUCTO/ÍTEM LIBRE) + SKU / resumen de receta / descripción.
4. **Descuento con control segmentado `$` / `%`** — MISMO patrón en nivel artículo y nivel orden. Al cambiar tipo: cambia el sufijo del input, se recalcula el monto y el "Precio final" en vivo. En modo % validar 0–100. En modo $ no permitir superar el subtotal de la línea.
5. **Receta compacta:** OD y OI en 2 columnas, cada una con checkbox "Con receta" y 3 inputs (Esf, Cil, Eje con sufijo °). Sin receta → inputs deshabilitados con opacidad. Tratamientos (Antirreflejo, Fotocromático, etc.) como chips toggle en una fila.
6. **Agregar artículo:** botón punteado full-width al final de la lista → menú con 3 opciones (Cristal: "Receta y tratamientos" / Producto: "Montura o accesorio del inventario" / Ítem libre: "Servicio o fórmula, sin inventario"). Al elegir, se CREA la fila inmediatamente y se abre su editor con el primer input enfocado (scroll into view).
7. **Footer sticky con todo lo decisivo:** Subtotal → Descuento en artículos (solo si >0) → Descuento de la orden (segmentado + input inline, muestra el monto restado en rojo) → Total (destacado, color acento). Luego textarea "Motivo de la modificación" (obligatorio, max 500, contador, hint "Queda registrado en la auditoría de ventas") y acciones [Cancelar | Guardar cambios].
8. **Guardar deshabilitado** hasta que: motivo no vacío Y todos los ítems válidos (cristal requiere cristal seleccionado + precio > 0; si "con receta" activo, requiere Esf o Cil; producto requiere producto y precio; libre requiere nombre y precio). Errores de validación inline bajo el campo, nunca toasts genéricos.
9. **Cantidad con stepper** [− n +], mínimo 1. Los totales de línea, el descuento y el total de la orden se recalculan en vivo.
10. **Meta bar:** Fecha (date), Cliente (con badge amarillo "C" si paga con Cashea, title tooltip), Nota — todo en una fila compacta, labels uppercase 10px encima de cada input.

### Tokens de diseño

- Acento: `indigo-600` (#4f46e5), hover `indigo-700`. Peligro: `rose-600`.
- Superficies: blanco / `slate-50` / `slate-100`. Bordes: `slate-200` y `slate-300`.
- Tipografía: sistema o Inter. Body 13px, nombre de ítem 13.5/600, labels 10–11px uppercase con letter-spacing, total 19px/800 tabular-nums.
- Radios: inputs 8px, chips/buttons 6–8px, menús 12px. Alto inputs 36px (32px en receta), botones 40px.
- Focus ring: `0 0 0 3px indigo-100` + borde indigo en todos los inputs.
- Acciones de fila (editar/borrar) solo visibles al hover de la fila.

### Estructura de componentes sugerida

```
src/lib/components/orders/
├── OrderEditDrawer.svelte      // shell: header, meta bar, body con scroll, footer
├── OrderMetaBar.svelte         // fecha, cliente, nota
├── ItemsList.svelte            // lista plana + fila "Agregar artículo" + menú
├── ItemRow.svelte              // fila (props: item, open, eventos edit/delete/toggle)
├── editors/
│   ├── CristalEditor.svelte    // búsqueda cristal, qty, precio, descuento, receta, chips
│   ├── ProductoEditor.svelte   // búsqueda producto, qty, precio, descuento
│   └── LibreEditor.svelte      // nombre, descripción, qty, precio, descuento
├── DiscountField.svelte        // segmentado $/% + input + precio final (reutilizable)
├── PrescriptionFields.svelte   // OD/OI con checkbox "Con receta" y Esf/Cil/Eje
└── OrderSummaryFooter.svelte   // resumen + descuento orden + motivo + acciones
```

Tipos:

```ts
type DiscountType = 'fixed' | 'percent';
interface OrderItem {
	id: string;
	type: 'cristal' | 'producto' | 'libre';
	refId?: string;
	name: string;
	sku?: string;
	desc?: string;
	qty: number;
	price: number;
	discount: number;
	discountType: DiscountType;
	rx?: { od?: RxEye; oi?: RxEye }; // solo cristal; undefined = sin receta
	treatments?: string[]; // solo cristal
}
interface RxEye {
	esf: number | null;
	cil: number | null;
	eje: number | null;
}
```

Cálculos: `lineDiscount = discountType === 'percent' ? price*qty*discount/100 : min(discount, price*qty)`; `subtotal = Σ(price*qty − lineDiscount)`; descuento de orden sobre el subtotal; `total = max(0, subtotal − orderDiscount)`. Formato moneda: `es-VE`, `$ 1.234,56`.

### Accesibilidad y UX

- Drawer: `role="dialog"` + `aria-modal`, focus trap dentro, ESC cierra (con confirm si hay cambios sin guardar), click en backdrop cierra.
- Filas: `role="button"` + `tabindex="0"` + `aria-expanded` en el editor; Enter abre/cierra.
- Menú de agregar: cierra con click fuera y ESC.
- Al eliminar un ítem, no pedir confirmación redundante si el guardado ya pasa por auditoría; mostrar toast reversible ("Quitar" con deshacer) si el framework lo permite.
- El botón "Guardar cambios" muestra un tooltip/hint explicando por qué está deshabilitado cuando aplique.

### Entregable

Refactoriza el componente actual sin cambiar la lógica de negocio ni el contrato con el backend (payload igual). Mantén los textos en español tal cual el mockup. Si usas Tailwind, mapea los tokens a las clases equivalentes; si usas CSS, usa las variables del mockup.

---
