# Stitch Prompt — Página "Detalle de Cliente" (`/customers/[id]`)

## Contexto

Optikt es un sistema de gestión para ópticas. Esta es la página de detalle de un cliente individual. Muestra toda su información personal y su historial completo de fórmulas ópticas (prescripciones).

**Páginas ya diseñadas:** App shell (navbar + sidebar), dashboard, lista de clientes (`/customers`), crear cliente (`/customers/new`).

**Patrón de edición de datos básicos:** Inline editing — los campos se convierten en inputs editables _in-place_, sin modal ni página aparte. El mismo card que muestra los datos se transforma en formulario editable.

**Patrón de fórmulas:** Crear y editar fórmulas se hace en páginas dedicadas (no modales). La lista de fórmulas vive en esta página con filas expandibles para ver el detalle rápido.

---

## Estructura de la página

**Layout:** Dentro del app shell (navbar arriba, sidebar izquierda). Contenido con padding en el área principal.

---

### Header de la página

- Link de retorno: `← Volver a clientes` (navega a `/customers`)
- **NO hay título de página explícito** — el nombre del cliente en el card de perfil actúa como título

---

### Sección 1 — Perfil del Cliente

Card blanco con borde sutil.

#### Estado: Modo lectura (default)

**Layout del header del card:**

- Izquierda: Avatar circular con la inicial del nombre (fondo azul cielo `#419ebd`, letra blanca, tamaño ~48px)
- Centro: Nombre completo en texto grande (ej: "Juan Antonio Pérez"). Debajo, la cédula en texto monospace gris (ej: "V-25888123")
- Derecha: Botón "Editar" con ícono de lápiz (botón outline/secundario)

**Datos de contacto (grid de 2 columnas en desktop, 1 en mobile):**

Mostrar como pares label + valor, con ícono sutil a la izquierda de cada dato:

| Dato                | Ícono       | Ejemplo               | Notas                            |
| ------------------- | ----------- | --------------------- | -------------------------------- |
| Teléfono            | 📞 Phone    | +58 412-1234567       | Si no tiene, mostrar "—" en gris |
| Email               | ✉️ Mail     | juan@email.com        | Si no tiene, mostrar "—" en gris |
| Fecha de Nacimiento | 🎂 Calendar | 15/03/1985            | Si no tiene, mostrar "—" en gris |
| Dirección           | 📍 MapPin   | Av. Principal, Centro | Si no tiene, mostrar "—" en gris |

**Sección de notas (solo si tiene notas):**

- Separador sutil encima
- Ícono de FileText + texto de las notas en un fondo ligeramente diferente (gris muy claro o azul muy tenue)

#### Estado: Modo edición (inline)

Al hacer click en "Editar", el card se transforma:

- El avatar y nombre se mantienen visibles arriba (no editables en este contexto — solo referencia visual)
- Los campos de datos se convierten en inputs editables, con el mismo layout de 2 columnas de la página `/customers/new`:
  - Fila 1: Nombre | Apellido
  - Fila 2: Cédula (select + input) | Fecha de Nacimiento
  - Fila 3: Teléfono | Email
  - Fila 4: Dirección (full width)
  - Fila 5: Notas (textarea, full width)
- Los valores actuales están pre-llenados en los inputs
- El botón "Editar" se reemplaza por dos botones:
  - **Cancelar** — botón ghost/texto, restaura modo lectura sin guardar
  - **Guardar** — botón primario, guarda y vuelve a modo lectura
- Transición suave entre modos (no abrupta)

---

### Sección 2 — Fórmula Actual (Resumen Destacado)

**Solo visible si el cliente tiene una fórmula marcada como "actual".**

Card con borde izquierdo de acento (azul cielo `#419ebd` o dorado `#f7cb16`) para distinguirla visualmente del card de perfil.

**Header del card:**

- Ícono de estrella ⭐ + "Fórmula Actual"
- A la derecha: Fecha de la fórmula y badge del tipo de lente (ej: "Monofocal", "Progresivo")

**Contenido (layout compacto, solo lectura):**

Mostrar lado a lado OD y OS en formato resumido:

```
Ojo Derecho (OD)              Ojo Izquierdo (OS)
-2.00  -0.50  x 180°          -1.75  -0.25  x 175°
Add: +1.50                     Add: +1.50
```

Debajo, en una fila:

- **DP:** 62mm | **NP Der:** 31mm | **NP Izq:** 31mm
- **Doctor:** Dr. Martínez (si tiene)

Tratamientos como badges inline: `Antireflejo` `Blueblock` (si tiene)

**Este card es solo lectura.** Para editar, el usuario usa el botón de la fila correspondiente en la lista de fórmulas de abajo.

---

### Sección 3 — Historial de Fórmulas

Card blanco con borde sutil.

**Header del card:**

- Título: "Fórmulas"
- Subtítulo: "Historial de fórmulas del cliente"
- A la derecha: Botón "**+ Nueva Fórmula**" — botón primario que navega a `/customers/[id]/prescriptions/new`

#### Lista de fórmulas

Cada fórmula es una fila en una lista. **Las filas son expandibles** (click para toggle detalle).

**Fila colapsada (estado por defecto):**

| Columna      | Contenido                                                     | Notas                                                                                  |
| ------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Fecha        | 15/03/2026                                                    | Formato DD/MM/YYYY                                                                     |
| Tipo         | Badge: "Monofocal"                                            | Coloreado según tipo                                                                   |
| OD (resumen) | -2.00 -0.50 x 180°                                            | Formato compacto en monospace                                                          |
| OS (resumen) | -1.75 -0.25 x 175°                                            | Formato compacto en monospace                                                          |
| Estado       | Badge "Actual" (si es la fórmula marcada como actual) ó vacío | Badge verde si es la actual                                                            |
| Acciones     | Íconos: Editar ✏️, Eliminar 🗑️                                | Editar navega a `/customers/[id]/prescriptions/[pid]/edit`. Eliminar pide confirmación |
| Chevron      | `▸` / `▾`                                                     | Indica expandible                                                                      |

**Fila expandida (al hacer click):**

Se despliega debajo de la fila un panel con el detalle completo:

- **OD y OS lado a lado** con todos los valores (esfera, cilindro, eje, adición si aplica)
- **Distancias:** DP, NP Derecho, NP Izquierdo
- **Tratamientos:** Lista de tratamientos activos como badges
- **Doctor:** Nombre si tiene
- **Notas:** Texto si tiene

Layout similar al resumen de "Fórmula Actual" pero dentro de la fila expandida.

#### Estado vacío

Si el cliente no tiene fórmulas:

- Ícono grande centrado (gafas o lente, sutil, gris)
- Texto: "No hay fórmulas registradas"
- Subtexto: "Agrega una fórmula para comenzar"
- El botón "+ Nueva Fórmula" sigue visible en el header del card

---

## Especificaciones de diseño

- **Paleta:** Azul marino `#152346`, Amarillo dorado `#f7cb16`, Azul cielo `#419ebd`
- **Tipografía:** Unbounded para títulos de sección. Inter para labels, valores y contenido
- **Cards:** Fondo blanco, borde sutil gris claro, border-radius 8px. Separación entre cards: 24px
- **Avatar:** Circular, 48px, fondo azul cielo, inicial en blanco, font-weight bold
- **Valores ópticos:** Siempre en fuente monospace para alineación visual
- **Badges de tipo de lente:** Colores sutiles diferenciados por tipo (Monofocal=azul, Bifocal=purple, Progresivo=gold, Ocupacional=gris)
- **Fórmula actual destacada:** Borde izquierdo coloreado (4px) para destacarla del resto
- **Inline editing:** Transición visual clara entre lectura y edición. Los campos editables deben tener un borde/fondo que los distinga del modo lectura
- **Filas expandibles:** Animación suave al expandir/colapsar. Fondo ligeramente diferente (gris muy claro) para el panel expandido
- **Responsive:** 2 columnas para datos de contacto y OD/OS en desktop. 1 columna en mobile
- **Acciones de fila:** Íconos pequeños, visibles al hover o siempre visibles en mobile

---

## Estados importantes para diseñar

1. **Vista normal con fórmula actual:** Perfil completo, card de fórmula actual visible, lista con varias fórmulas (una marcada como actual). Este es el estado más común y la prioridad visual.

2. **Vista con edición inline activada:** El card de perfil en modo edición con los inputs pre-llenados. Botones Guardar/Cancelar visibles. El resto de la página (fórmula actual, lista de fórmulas) sigue visible debajo, sin cambios.

3. **Fila de fórmula expandida:** Una fórmula de la lista expandida mostrando el detalle completo. Las demás filas permanecen colapsadas.

4. **Cliente sin fórmulas:** Card de perfil normal, no se muestra card de "Fórmula Actual", la sección de historial muestra el estado vacío con ícono y mensaje.

5. **Cliente con datos mínimos:** Solo nombre, apellido y teléfono (sin email, dirección, notas, fórmulas). Los campos vacíos muestran "—" en gris.

---

## Referencia visual

Consistente con:

- Lista de clientes (`/customers`) — ya diseñada
- Crear cliente (`/customers/new`) — ya diseñada (reusar layout de campos para inline editing)
- App shell (navbar + sidebar) — ya diseñado

Estilo general: limpio, profesional, densidad media. Cards blancos sobre fondo gris muy claro. Información densa pero organizada — esta es la página donde el usuario pasa más tiempo por cliente.
