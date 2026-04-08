# Stitch Prompt — Páginas "Nueva Fórmula" y "Editar Fórmula"

## Contexto

Optikt es un sistema de gestión para ópticas. Estas son dos páginas dedicadas para crear y editar fórmulas ópticas (prescripciones) de un cliente específico. Se accede desde la página de detalle del cliente (`/customers/[id]`).

**Rutas:**

- Nueva fórmula: `/customers/[id]/prescriptions/new`
- Editar fórmula: `/customers/[id]/prescriptions/[pid]/edit`

**Páginas ya diseñadas:** App shell (navbar + sidebar), dashboard, lista de clientes, crear cliente (`/customers/new`), detalle de cliente (`/customers/[id]`).

**Importante:** El formulario de fórmula es **exactamente el mismo** que la Sección 2 ("Fórmula Óptica") de la página `/customers/new`, pero aquí ocupa la página completa (no es una sección colapsable). Los campos, layout, validaciones y comportamiento son idénticos. La única diferencia es el contexto: aquí es una página independiente con su propio header, breadcrumb y botones de acción.

---

## Estructura de la página

**Layout:** Dentro del app shell (navbar arriba, sidebar izquierda). Contenido con padding en el área principal. Formulario de una sola página con scroll.

---

### Header de la página

**Para nueva fórmula:**

- Link de retorno: `← Volver a Juan Antonio` (navega a `/customers/[id]`, usando el nombre del cliente)
- Título: **"Nueva Fórmula"**
- Subtítulo: "Registrar nueva fórmula óptica para **Juan Antonio Pérez**" (nombre completo del cliente en negrita)

**Para editar fórmula:**

- Link de retorno: `← Volver a Juan Antonio` (navega a `/customers/[id]`)
- Título: **"Editar Fórmula"**
- Subtítulo: "Modificar fórmula del **15/03/2026** de **Juan Antonio Pérez**" (fecha de la fórmula + nombre del cliente, ambos en negrita)

---

### Card del formulario

Card blanco con borde sutil, border-radius 8px, padding 24px.

#### Fila superior (4 elementos en desktop, se apilan en mobile)

| Campo            | Tipo               | Requerido | Default/Placeholder                        | Notas                                                                     |
| ---------------- | ------------------ | --------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Fecha de Fórmula | Date picker        | ✅ Sí     | Hoy (nueva) / fecha existente (editar)     | No permite fechas futuras. Ícono de calendario en el input                |
| Tipo de Lente    | Select/Dropdown    | ❌ No     | Monofocal                                  | Opciones: Monofocal, Bifocal, Progresivo, Ocupacional. Default: Monofocal |
| Doctor           | Text input         | ❌ No     | `Nombre del doctor`                        | Máx 100 chars                                                             |
| ☑ Fórmula actual | Checkbox con label | —         | Checked (nueva) / valor existente (editar) | Marca esta fórmula como la activa del cliente                             |

**Layout:** Los 3 campos en una fila + el checkbox alineado a la derecha del Doctor. En mobile: 2 columnas (Fecha \| Tipo de Lente, Doctor \| Checkbox).

---

#### Subsección: Ojo Derecho (OD) y Ojo Izquierdo (OS)

**Layout:** Dos bloques lado a lado en desktop. Cada bloque tiene su propio header y campos. En mobile se apilan verticalmente (OD arriba, OS abajo).

**Header de cada bloque:**

- "Ojo Derecho (OD)" a la izquierda
- "Ojo Izquierdo (OS)" a la derecha
- Separación visual clara entre ambos bloques (gap de 24px o línea divisoria vertical sutil)

**Campos por ojo (idénticos para OD y OS):**

| Campo    | Tipo         | Requerido          | Placeholder | Validación                                                                                                                                     |
| -------- | ------------ | ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Esfera   | Number input | ⚠️ Condicional     | `-2.00`     | Rango -30.00 a +30.00. Pasos de 0.25 dioptrías. Al menos Esfera O Cilindro debe tener valor                                                    |
| Cilindro | Number input | ⚠️ Condicional     | `-0.50`     | Rango -10.00 a 0.00 (solo negativo o cero). Pasos de 0.25 dioptrías. Al menos Esfera O Cilindro debe tener valor                               |
| Eje      | Number input | ⚠️ Si hay cilindro | `180`       | Rango 0 a 180 grados. Solo números enteros. **Requerido si Cilindro tiene valor** — indicar visualmente (asterisco rojo aparece dinámicamente) |
| Adición  | Number input | ❌ No              | `+1.50`     | **Solo visible si Tipo de Lente ≠ Monofocal.** Pasos de 0.25. Campo oculto completamente cuando el tipo es Monofocal                           |

**Layout de campos dentro de cada bloque (OD o OS):**

- Si Monofocal: Una fila de 3 campos → Esfera \| Cilindro \| Eje
- Si Bifocal/Progresivo/Ocupacional: Una fila de 4 campos → Esfera \| Cilindro \| Eje \| Adición

**Reglas de validación visual:**

- Si el usuario llena Cilindro pero no Eje → el label de Eje muestra asterisco rojo y el campo se marca como requerido
- Si ambos Esfera y Cilindro están vacíos → ambos muestran error: "Se necesita al menos Esfera o Cilindro"
- Valores ópticos siempre en fuente **monospace** para alineación visual

---

#### Subsección: Distancias

**Header:** "Distancias" (título de subsección)

**Layout:** Fila de 3 campos del mismo ancho.

| Campo             | Tipo         | Requerido | Placeholder | Validación                                                 |
| ----------------- | ------------ | --------- | ----------- | ---------------------------------------------------------- |
| DP (mm)           | Number input | ❌ No     | `62`        | Distancia pupilar total. Rango 10 a 80 mm. Números enteros |
| NP Derecho (mm)   | Number input | ❌ No     | `31`        | Nasopupilar derecho. Rango 10 a 80 mm. Números enteros     |
| NP Izquierdo (mm) | Number input | ❌ No     | `31`        | Nasopupilar izquierdo. Rango 10 a 80 mm. Números enteros   |

**Nota UX:** Estos campos son opcionales pero importantes. Si el usuario intenta guardar sin llenarlos, se muestra un diálogo de confirmación: "¿Continuar sin datos de distancia?" con botones "Volver" y "Continuar sin distancias". **No** bloquea el submit — solo advierte.

---

#### Subsección: Tratamientos

**Header:** "Tratamientos" (título de subsección)

**Layout:** Fila de checkboxes inline (horizontal en desktop, se wrappean en mobile).

| Checkbox | Label         | Comportamiento                                                                                                                                                                        |
| -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐        | Antireflejo   | Toggle on/off                                                                                                                                                                         |
| ☐        | Blueblock     | Toggle on/off                                                                                                                                                                         |
| ☐        | Fotocromático | Toggle on/off                                                                                                                                                                         |
| ☐        | Otros         | Al activar, aparece un text input debajo: placeholder "Describa el tratamiento". El input es **requerido** si el checkbox está activo. Al desactivar, el input desaparece y se limpia |

---

#### Subsección: Notas

**Layout:** Full width.

| Campo | Tipo     | Requerido | Placeholder                 |
| ----- | -------- | --------- | --------------------------- |
| Notas | Textarea | ❌ No     | `Observaciones adicionales` |

2 filas de alto por defecto. Sin límite de caracteres.

---

### Barra de acciones (al final del card o sticky en el bottom)

Alineada a la derecha. Dos botones:

**Para nueva fórmula:**

- **Cancelar** — botón secundario/outline. Navega de vuelta a `/customers/[id]`
- **Crear Fórmula** — botón primario (azul). Crea la fórmula y navega a `/customers/[id]`

**Para editar fórmula:**

- **Cancelar** — botón secundario/outline. Navega de vuelta a `/customers/[id]`
- **Guardar Cambios** — botón primario (azul). Guarda y navega a `/customers/[id]`

---

## Especificaciones de diseño

- **Paleta:** Azul marino `#152346`, Amarillo dorado `#f7cb16`, Azul cielo `#419ebd`
- **Tipografía:** Unbounded para el título de la página y headers de subsección (Ojo Derecho, Distancias, Tratamientos). Inter para labels, placeholders y contenido
- **Card:** Fondo blanco, borde sutil gris claro (`border: 1px solid` ~`#e2e8f0`), border-radius 8px, padding 24px
- **Spacing:** Gap entre campos 16px. Separación entre subsecciones 24px. Margen entre header y card 16px
- **Campos requeridos:** Asterisco rojo (\*) en el label, borde rojo en estado error, mensaje de error en rojo debajo del campo
- **Inputs numéricos ópticos:** Fuente monospace, ancho moderado (~120px), alineación del texto a la derecha
- **Headers OD/OS:** Font-weight 600, texto `#152346`, tamaño 16px. Separación clara entre ambos bloques
- **Checkboxes de tratamientos:** Tamaño cómodo para click (min 20px checkbox), spacing entre ellos de 24px
- **Botón primario:** Fondo azul de la app, texto blanco, border-radius 6px, padding horizontal generoso
- **Botón secundario:** Outline/ghost, texto gris oscuro, sin fondo
- **Responsive:** Bloques OD/OS lado a lado en desktop (50/50), apilados en mobile. Distancias en 3 columnas → 1 columna en mobile. Tratamientos wrap naturalmente

---

## Estados importantes para diseñar

1. **Nueva fórmula — Estado inicial:** Formulario vacío, fecha pre-llenada con hoy, tipo de lente en Monofocal (campo Adición oculto), checkbox "Fórmula actual" activado, todos los campos ópticos vacíos con sus placeholders visibles

2. **Nueva fórmula — Tipo Progresivo seleccionado:** Mismo que el estado 1 pero con el campo "Adición" visible en ambos bloques OD y OS (4 campos por ojo en vez de 3)

3. **Editar fórmula — Pre-llenado:** Todos los campos con los valores existentes. Fecha con la fecha original de la fórmula. Tipo de lente correspondiente. Valores ópticos en monospace. Tratamientos con checkboxes activos según corresponda

4. **Estado de error — Validación:** Campos requeridos vacíos con borde rojo, mensaje de error en texto rojo pequeño debajo de cada campo afectado. Ejemplo: Cilindro lleno pero Eje vacío → Eje marcado en rojo con "El eje es requerido cuando hay cilindro"

---

## Referencia visual

Esta página debe ser **visualmente idéntica** a la Sección 2 ("Fórmula Óptica") de la página `/customers/new`, con la diferencia de que aquí es una página completa con su propio header y breadcrumb, no una sección colapsable.

Consistente con:

- Crear cliente (`/customers/new`) — el formulario de fórmula es el mismo
- Detalle de cliente (`/customers/[id]`) — el breadcrumb sigue el mismo patrón
- App shell (navbar + sidebar) — ya diseñado

Estilo general: limpio, profesional, densidad media. Card blanco sobre fondo gris muy claro. Formulario enfocado sin distracciones — el usuario viene a hacer una tarea específica (registrar o corregir una fórmula óptica).
