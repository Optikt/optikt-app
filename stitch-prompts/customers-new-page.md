# Stitch Prompt — Página "Crear Cliente" (`/customers/new`)

## Contexto

Optikt es un sistema de gestión para ópticas. Actualmente, la creación de clientes se hace via modal. El problema es que el modal solo cubre datos básicos del cliente, y luego hay que ir al detalle del cliente para agregar la fórmula óptica (prescripción). Queremos **unificar ambos pasos en una sola página dedicada** (`/customers/new`) para que el usuario pueda crear el cliente y opcionalmente agregar su primera fórmula en el mismo flujo.

La página de lista de clientes (`/customers`) ya está diseñada. El botón "Agregar Cliente" ahora navegará a esta nueva página en vez de abrir un modal.

---

## Diseño de la página `/customers/new`

**Layout:** Página completa dentro del app shell (navbar arriba, sidebar izquierda — ya diseñados). El contenido ocupa el área principal con padding.

**Estructura general:** Formulario de una sola página con dos secciones claramente diferenciadas. NO es wizard/stepper — es un formulario continuo con scroll.

---

### Header de la página

- Breadcrumb o link de retorno: `← Volver a clientes` (navega a `/customers`)
- Título: **"Nuevo Cliente"**
- Subtítulo: "Completa los datos del cliente y opcionalmente agrega su primera fórmula óptica"

---

### Sección 1 — Datos del Cliente

Card/contenedor blanco con borde sutil.

**Título de sección:** "Información Personal"

**Campos (2 columnas en desktop, 1 en mobile):**

| Campo               | Tipo                          | Requerido | Placeholder                         | Notas                                                                 |
| ------------------- | ----------------------------- | --------- | ----------------------------------- | --------------------------------------------------------------------- |
| Nombre              | Text input                    | ✅ Sí     | —                                   | Máx 100 chars                                                         |
| Apellido            | Text input                    | ✅ Sí     | —                                   | Máx 100 chars                                                         |
| Cédula              | Select (V/E/J/G) + Text input | ❌ No     | `12345678`                          | El select tiene las opciones V, E, J, G. El input solo acepta números |
| Fecha de Nacimiento | Date picker                   | ✅ Sí     | DD/MM/AAAA                          | No permite fechas futuras                                             |
| Teléfono            | Text input                    | ✅ Sí     | `+58 412-1234567`                   | Formato venezolano                                                    |
| Email               | Text input                    | ❌ No     | `cliente@email.com`                 | —                                                                     |
| Dirección           | Text input                    | ❌ No     | `Av. Principal, Centro...`          | Línea completa (full width)                                           |
| Notas               | Textarea                      | ❌ No     | `Observaciones sobre el cliente...` | 2-3 filas, full width                                                 |

**Layout de campos:**

- Fila 1: Nombre | Apellido
- Fila 2: Cédula (select + input combinados) | Fecha de Nacimiento
- Fila 3: Teléfono | Email
- Fila 4: Dirección (full width)
- Fila 5: Notas (full width)

---

### Sección 2 — Primera Fórmula Óptica (Opcional)

**Esta sección es colapsable/expandible.**

Estado por defecto: **colapsada** — muestra solo el header con un toggle o botón para expandir.

**Header de sección (siempre visible):**

- Título: "Fórmula Óptica"
- Subtítulo: "Agrega la primera fórmula del cliente (opcional)"
- Un toggle/switch o botón "Agregar Fórmula" para expandir la sección
- Cuando está colapsada, se ve limpia y no distrae del formulario principal

**Contenido expandido (dentro del mismo card o un card separado):**

#### Fila superior (3 campos + checkbox):

| Campo            | Tipo            | Requerido                    | Placeholder         | Notas                                                 |
| ---------------- | --------------- | ---------------------------- | ------------------- | ----------------------------------------------------- |
| Fecha de Fórmula | Date picker     | ✅ Sí (si se agrega fórmula) | Hoy por defecto     | No permite fechas futuras                             |
| Tipo de Lente    | Select/Dropdown | ❌ No                        | Monofocal           | Opciones: Monofocal, Bifocal, Progresivo, Ocupacional |
| Doctor           | Text input      | ❌ No                        | `Nombre del doctor` | Máx 100 chars                                         |
| ☑ Fórmula actual | Checkbox        | —                            | Checked por defecto | Marca como fórmula activa                             |

#### Subsección: Ojo Derecho (OD) y Ojo Izquierdo (OS)

Mostrar lado a lado en desktop (OD a la izquierda, OS a la derecha). Cada ojo tiene:

| Campo    | Tipo         | Placeholder | Notas                                                 |
| -------- | ------------ | ----------- | ----------------------------------------------------- |
| Esfera   | Number input | `-2.00`     | Rango -30 a +30, pasos de 0.25                        |
| Cilindro | Number input | `-0.50`     | Rango -10 a 0 (solo negativo), pasos de 0.25          |
| Eje      | Number input | `180`       | Rango 0-180°, solo enteros. Requerido si hay cilindro |
| Adición  | Number input | `+1.50`     | Solo visible si tipo de lente ≠ Monofocal             |

**Reglas de validación visual:**

- Al menos Esfera O Cilindro debe tener valor (por ojo)
- Si hay Cilindro, el Eje se vuelve requerido (indicar visualmente)
- Adición solo aparece para Bifocal, Progresivo, Ocupacional

#### Subsección: Distancias

Fila de 3 campos:

| Campo             | Tipo         | Placeholder | Notas                                |
| ----------------- | ------------ | ----------- | ------------------------------------ |
| DP (mm)           | Number input | `62`        | Distancia pupilar total. Rango 10-80 |
| NP Derecho (mm)   | Number input | `31`        | Nasopupilar derecho. Rango 10-80     |
| NP Izquierdo (mm) | Number input | `31`        | Nasopupilar izquierdo. Rango 10-80   |

#### Subsección: Tratamientos

Fila de checkboxes inline:

- ☐ Antireflejo
- ☐ Blueblock
- ☐ Fotocromático
- ☐ Otros → si se marca, aparece un text input: "Describa el tratamiento"

#### Notas de fórmula

| Campo | Tipo     | Placeholder                 |
| ----- | -------- | --------------------------- |
| Notas | Textarea | `Observaciones adicionales` |

---

### Barra de acciones (footer sticky o al final)

Alineada a la derecha, siempre visible:

- **Cancelar** — botón secundario/outline, navega de vuelta a `/customers`
- **Crear Cliente** — botón primario (azul de la app). Si la fórmula está expandida y tiene datos, crea ambos en una sola acción

---

## Especificaciones de diseño

- **Paleta:** Azul marino `#152346`, Amarillo dorado `#f7cb16`, Azul cielo `#419ebd` — consistente con el resto del redesign
- **Tipografía:** Unbounded para títulos de sección. Sans-serif (Inter) para labels y contenido
- **Cards:** Fondo blanco, borde sutil (`border: 1px solid` gris muy claro), border-radius 8px
- **Spacing:** Padding interno del card 24px. Separación entre secciones 24px. Gap entre campos 16px
- **Campos requeridos:** Mostrar asterisco rojo (\*) en el label
- **Estado colapsado de fórmula:** Debe verse como una sección inactiva pero invitante — no escondida. Un toggle, switch, o botón con ícono de `+` que invite al usuario a expandirla
- **Responsive:** 2 columnas en desktop para campos de cliente y datos ópticos. 1 columna en mobile
- **Sección OD/OS:** Usar headers claros "Ojo Derecho (OD)" y "Ojo Izquierdo (OS)" con separación visual. En desktop mostrar lado a lado

---

## Estados importantes para diseñar

1. **Estado inicial:** Formulario vacío, sección de fórmula colapsada
2. **Formulario con fórmula expandida:** Todos los campos visibles, tipo de lente en Monofocal (sin campo de Adición)
3. **Formulario con tipo Progresivo seleccionado:** Campos de Adición visibles para OD y OS
4. **Estado de error:** Campos requeridos vacíos con borde rojo y mensaje de error debajo del campo

---

## Referencia visual

Esta página debe ser consistente con:

- La página de lista de clientes (`/customers`) — ya diseñada
- El app shell (navbar + sidebar) — ya diseñado
- El dashboard — ya diseñado

Estilo general: limpio, profesional, densidad media (no demasiado espaciado, no demasiado compacto). Cards blancos sobre fondo gris muy claro. Campos de formulario con bordes sutiles y buen contraste.
