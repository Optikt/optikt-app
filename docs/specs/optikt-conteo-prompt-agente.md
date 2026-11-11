# Prompt para el code agent · Rediseño total del Conteo Físico (Optikt)

> Documento de implementación. Va acompañado del mockup interactivo `optikt-conteo-mockup.html` (abrirlo en el navegador y revisarlo en sus tres tamaños).
> Responsable de producto y decisiones: Nanez. Si algo no está aquí ni en el mockup, **no lo inventes: pregúntalo** (ver sección 17).

---

## 0. Cómo usar este documento

**Jerarquía de verdad (de mayor a menor):**

1. **El repo**: tokens (`src/routes/layout.css`), kit `src/lib/components/ui/`, convenciones de `.github/instructions/`. Colores, tipografía, radios, sombras y componentes del repo **ganan siempre** sobre el mockup.
2. **Este documento**: reglas de negocio, comportamiento, fases, criterios de aceptación.
3. **El mockup HTML**: referencia visual y de interacción. Léelo (CSS y JS incluidos) para medidas, estados, microcopy y textos de tooltips. Cuando difiera de este documento, manda el documento y lo señalas.

**Orden de trabajo:** sección 17 (preguntas abiertas, verificar contra el código) → fases de la sección 15, **una por una**, con `pnpm lint && pnpm test` en verde al cerrar cada fase. Al terminar cada fase, resume qué hiciste, qué difiere del mockup y qué dudas quedaron. Nanez te enviará capturas y luego un prompt de corrección.

---

## 1. Contexto y alcance

**Producto:** Optikt es el sistema de ventas / punto de venta de una óptica pequeña (2 a 4 personas, incluidos los dueños). El módulo **Conteo Físico** (`/inventory/count`) hoy funciona como una lista de sesiones aisladas con una tabla de 674 líneas (todas las de la sesión), edición inline una por una y un modal de creación con tres alcances fijos.

**Problemas que resuelve el rediseño (priorizados):**

- **P0** No existe la vista «¿cuándo se contó cada cosa y qué falta por verificar?». Cada sesión es una foto aislada.
- **P0** Contar es un flujo de ratón (clic en «Contar», teclear, Enter, repetir ×674). No hay avance automático.
- **P0** En 1280×720 la cabecera y las métricas ocupan más de la mitad de la altura; la tabla muestra ~1,5 filas; hay scroll anidado.
- **P0** El alcance es demasiado grueso (Todo / Productos / Lentes). No se puede contar por marca, proveedor, tipo ni combinaciones, ni hay vista previa del tamaño del conteo.
- **P1** Bucle de ajuste roto (pestaña nueva, checkbox «Hecho» sin vínculo de datos), dead-end de permisos, ruido de métricas, historial que se parte en 1280, modal que desborda en 720, sesiones canceladas con dashboard completo, color sin significado.

**Alcance del trabajo:** el **contenido** de las pantallas del módulo, es decir, lo que va dentro del `<main>` del shell. Además, la capa de datos y servidor que la UI exige (sección 12) y el flujo de ajuste dentro de la sesión.

**Pantallas resultantes:**

| Ruta                        | Contenido                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `/inventory/count`          | Pestañas **Cobertura** (entrada) e **Historial**                                                    |
| `/inventory/count/[id]`     | Espacio de trabajo de la sesión: fases ① Contar · ② Revisar · ③ Cerrar → **Informe** (solo lectura) |
| Panel lateral (`SlideOver`) | Nuevo conteo · Ajustes del ciclo · Responsables · Ajustar stock · Cancelar conteo                   |

---

## 2. Qué NO tocar

- **El shell**: navbar, sidebar, layout `(app)`. El mockup los dibuja como un marco gris rotulado «SHELL ACTUAL» solo para dar el tamaño real del área de contenido (≈ 1208×636 en 1280×720). No lo repliques.
- El ítem «Conteo Físico» del sidebar y su icono dinámico (`ClipboardList` → `ClipboardCheck` con sesión activa). Se mantiene tal cual.
- La lógica de ajuste manual de stock existente (lotes FIFO, confirmación por pérdida financiera, generación de `inventory_movement` tipo `MANUAL_ADJUSTMENT`). **Se reutiliza**, no se reescribe (ver 12.6).
- Productos, lentes, ventas, compras y caja.
- Los tokens del repo (no crear colores nuevos; ver sección 4).

---

## 3. Objetivo, restricciones e invariantes

**Objetivo:** hacer el conteo físico **fácil, rápido (teclado/teléfono) y trazable**, y responder siempre con claridad a dos preguntas: **¿cuándo se contó cada cosa?** y **¿qué falta por verificar?**

**Restricciones técnicas (innegociables):**

- SvelteKit 2 + Svelte 5 con **runes** (`$state`, `$derived`, `$props`, `$bindable`, snippets). TypeScript. Tailwind v4 (tokens en `@theme`).
- Reutiliza el kit antes de crear componentes; **dime cuando algo no exista o no alcance** (sección 11.3).
- Iconos con `@lucide/svelte` (imports explícitos), toasts con `svelte-sonner`, tooltips propios (**nunca `title`**), sin barrels, **sin dependencias nuevas** (si una función exige una, pregunta primero).
- Carga inicial en `+page.server.ts`; el resto con remote functions (`$app/server`, `query`/`command`). Validación Zod en cliente y servidor. Nunca `$effect`/`onMount` para datos iniciales.
- Accesibilidad no opcional. Tests al cambiar comportamiento.

**Invariantes de negocio que se MANTIENEN:**

1. Una única sesión `OPEN` en todo el sistema (índice único parcial + guard en `createSession`).
2. **Snapshot inmutable**: `systemStock` se fija al crear; `difference = stock final − systemStock`; nunca se compara contra el stock vivo.
3. **El conteo nunca modifica stock automáticamente.** El stock solo cambia cuando una persona autorizada ejecuta una acción explícita de ajuste (individual o «Aplicar todo (N)»), que reutiliza la lógica de ajuste manual.
4. Cambiar un conteo **invalida el ajuste ya hecho** de esa línea si cambió el conteo o la diferencia (equivalente al reset actual del tracking).
5. Cancelar exige motivo (5 a 500 caracteres). Notas de sesión ≤ 500, notas de línea ≤ 240. Conteo entero ≥ 0.
6. Rollback optimista ante fallo de guardado de línea.
7. Guard de rol en cada `load` **y** en cada remote function.
8. Los tests existentes se actualizan donde cambie la regla; ninguno se borra sin reemplazo.

**Invariantes que CAMBIAN (decisiones ya tomadas por Nanez):**

| Antes                                        | Ahora                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cerrar solo al 100 % de las líneas contadas  | Se puede cerrar cuando **todas las líneas con `systemStock > 0` están contadas** y **toda línea con                                                          | diferencia | ≥ umbral fue recontada**. Las líneas con stock 0 sin confirmar **no bloquean** el cierre, pero **no cuentan como verificadas** |
| Contar: ADMIN/MANAGER/SELLER sin restricción | Contar/ver interactivamente: **responsables de la sesión que sean usuarios + ADMIN/MANAGER siempre**. Un SELLER no asignado ve la sesión en **solo lectura** |
| Alcance: `ALL` / `PRODUCT_CATEGORY` / `LENS` | Alcance estructurado: Todo, atajos, o **varias** marcas / proveedores / tipos (nunca cruzados entre dimensiones)                                             |
| Ajuste en pestaña nueva + checkbox «Hecho»   | Ajuste **dentro de la sesión** (panel lateral), con el movimiento de inventario **vinculado a la línea**                                                     |
| Sin cobertura histórica                      | **Cobertura por ítem** acumulada (último conteo cerrado) con semáforos y ciclo configurable                                                                  |

---

## 4. Tokens, tipografía y reglas visuales (prioridad: el repo)

**Regla de oro:** usa los tokens y clases del repo. La tabla muestra qué valor usa el mockup y a qué token corresponde. **Si un valor del mockup no coincide con un token del repo, usa el token del repo y avísame.**

### 4.1 Color

| Rol en el mockup                                                               | Valor del mockup                            | Token del repo                                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Estructura, títulos, botones primarios, header de sesión                       | `#152346`                                   | `brand-navy` (hover `brand-navy-dark` `#000d2f`)                                                                                  |
| **CTA principal** (Nuevo conteo, Continuar, Iniciar, Revisar, Cerrar conteo)   | `#fcd01e` con texto navy                    | `brand-gold` (hover `brand-gold-dark` `#edc200`). **El brandboard dice `#f7cb16`: ignóralo, manda el repo**                       |
| Foco, selección, barras de progreso, fila activa                               | `#419ebd` / fondo `#d4eef8`                 | `brand-blue` / `info-container`                                                                                                   |
| Fondo de página en Cobertura                                                   | `#fbf8fc`                                   | `surface`                                                                                                                         |
| Fondo del cuerpo en la sesión (lenguaje del drawer «editar venta»)             | `#edf1f6`                                   | **El mismo token/clase que ya usa el drawer de editar venta.** Si no es un token, reutiliza esa misma clase y no cambies el valor |
| Tarjetas                                                                       | `#ffffff`                                   | `surface-container-lowest`, radio 12, sombra `--ds-shadow-md`                                                                     |
| Hover de fila / cabeceras de tabla / cabecera de grupo                         | `#f5f3f6`                                   | `surface-container-low`                                                                                                           |
| Pistas y tracks de barras                                                      | `#efedf1`                                   | `surface-container`                                                                                                               |
| Texto primario / secundario                                                    | `#1b1b1e` / `#45464e`                       | `on-surface` / `on-surface-variant`                                                                                               |
| **Etiquetas** (uppercase)                                                      | `#45464e`, 12 px, 700                       | `on-surface-variant`. **Nunca `outline` `#75777f` para texto** (contraste límite)                                                 |
| Bordes                                                                         | `#c6c6cf`                                   | `outline-variant`                                                                                                                 |
| Éxito / coincide / al día                                                      | `#12b76a`, texto `#027a48`, fondo `#d1fadf` | `success`, `on-success-container`, `success-container`                                                                            |
| Advertencia / por vencer / diferencia **bajo** el umbral                       | `#f79009`, texto `#b54708`, fondo `#fef0c7` | `warning`, `on-warning-container`, `warning-container`                                                                            |
| Error / vencido / diferencia **sobre** el umbral / cancelar                    | `#ba1a1a`, texto `#93000a`, fondo `#ffdad6` | `error`, `on-error-container`, `error-container`                                                                                  |
| **Texto pequeño en azul de acento** (enlaces, «Ver informe →», «Agregar nota») | `#1e4f5e`                                   | `info` on-container (`#1e4f5e`). **No usar `brand-blue` para texto pequeño sobre blanco: da ~3:1**                                |
| Overlay de paneles                                                             | navy al 35 %                                | `bg-brand-navy/35` (el blur es opcional; mejor sin blur por costo en equipos viejos)                                              |

**Reglas de color:** estructura monocroma; el color solo comunica **estado, acción, error o éxito**. Un solo acento. **Ceros no se colorean** (hoy salen en verde/rojo/negro: eliminar). **El color nunca va solo**: cada estado lleva icono, texto o tooltip.

### 4.2 Tipografía

- **Inter** (cuerpo) y **Space Grotesk** (títulos, cifras grandes) **del repo** (`.font-heading`). No importes fuentes (el mockup carga Google Fonts solo para verse bien suelto). **El brandboard menciona Unbounded: ignóralo.**
- `tabular-nums` en **todos** los números, SKUs e IDs.
- **Problema detectado en el mockup v1:** el texto se veía demasiado pequeño. El repo usa `html { font-size: 18px }`, así que `text-sm` ≈ 15,75 px y `text-xs` ≈ 13,5 px.
- **Piso de tamaños (px efectivos, ≥ lo que muestra el mockup):**

| Elemento                              | px efectivos        | Referencia                                                      |
| ------------------------------------- | ------------------- | --------------------------------------------------------------- |
| Título de página (`h1`)               | 24                  | Space Grotesk 700, navy                                         |
| Cifra grande del ciclo                | 40                  | Space Grotesk 700                                               |
| KPIs del informe                      | 26                  | Space Grotesk 700                                               |
| Texto de cuerpo y filas               | 15 (16 en teléfono) | `text-sm` del repo                                              |
| Input de conteo                       | 16                  | 700, `tabular-nums`                                             |
| Etiquetas uppercase                   | 12                  | 700, `tracking` de la convención del repo, `on-surface-variant` |
| Tooltips                              | 13                  |                                                                 |
| Ficha móvil: nombre / sistema / input | 20 / 56 / 36        | Space Grotesk                                                   |

**No hagas nada más pequeño que esto.** Convierte a rem (÷18) o usa las utilidades del repo, y compara visualmente con el mockup a 1280×720.

### 4.3 Forma, espaciado, sombra, movimiento

- Grid de 4 px. Radios del sistema **4/8/12** (tarjetas 12, botones y inputs 8, tags y badges 6). Sin radios grandes en chips. Círculos solo para avatares y puntos de semáforo.
- Sombras en capas del repo (`--ds-shadow-*`). **Sin gradientes decorativos, sin bordes ≥ 2 px** (el anillo de foco de 2 px es la excepción por accesibilidad: `ring` de `brand-blue`, no `border`).
- Movimiento: 150 ms micro, 200–250 ms transiciones, easing `cubic-bezier(.25,1,.5,1)`, **sin rebotes**. Respeta `prefers-reduced-motion` (todo a 0 ms).
- Eco del brandboard: **dos barras diagonales** en el header de la sesión (azul 7 px, dorada 4 px, `skewX(-20deg)`, a la izquierda). Solo ahí, nada más.

---

## 5. Principios de diseño

1. **Cobertura primero, sesión después.** El módulo abre respondiendo «qué está al día y qué falta».
2. **Contar = teclear + Enter.** Cero ratón por ítem; el cursor salta al siguiente pendiente.
3. **El cuerpo manda en 1280×720.** Cabecera + resumen + filtros ≤ ~130 px en la sesión (≈ 20 % del alto útil), el resto es tabla. **Sin scroll dentro de scroll**: un único contenedor con scroll en la lista.
4. **El alcance son filtros con vista previa viva.** Se ve cuántos ítems entran antes de empezar.
5. **Estado con iconos + tooltip**, no con pills de texto. Color con significado.
6. **Salir es pausar**: el progreso se guarda por línea. Deshacer en lugar de confirmar; confirmar solo lo destructivo (cancelar).
7. **Explicar sin ocupar espacio**: textos de ayuda siempre en tooltip, nunca párrafos fijos.
8. **Teléfono es ciudadano de primera**: se cuenta mucho desde el celular en la tienda.

---

## 6. Estructura general y responsive

**Viewports de diseño:** Oficina **1280×720** (prioridad), Casa **1920×1080**, Teléfono **390×844**. Breakpoint de teléfono: `<lg` (consistente con el patrón actual de `DataGrid`).

- **Contenedor**: padding 16, contenido centrado con `max-width ≈ 1360 px`.
- **≥ 1600 px**, en la sesión: la franja de resumen pasa a una **columna fija derecha de 260 px** (misma información, vertical) y la lista se limita a ~1360 px, para que el SKU no quede a 700 px del nombre ni «Contar» a 2000 px (problema de las capturas actuales).
- **Teléfono**: tabla de Cobertura → tarjetas; el panel lateral → pantalla completa; Contar → **Ficha** (con alternancia Ficha | Lista); sin atajos de teclado; objetivos táctiles ≥ 44 px; `inputmode="numeric"` y `enterkeyhint="next"`.

---

## 7. Especificación por zona

> Medidas en px efectivos. «Mockup» = valores del archivo HTML adjunto. Los textos exactos de tooltips y microcopy **se toman del mockup** (atributos `data-tip`, formato `Título|Cuerpo`).

### 7.1 `/inventory/count` · Pestaña **Cobertura** (entrada)

**Header de página** (`PageHeader` si encaja; si no, estructura equivalente): `h1` «Conteo físico» · `SegmentedToggle` [Cobertura | Historial] · espacio · botón **⚙ Ajustes del ciclo** (icono `Settings`, 32×32, tooltip) · **CTA dorado**: «+ Nuevo conteo» o, si hay sesión abierta, «▶ Continuar» (mismo botón, mismo lugar, mismo color).

**Franja de sesión en curso** (solo si hay sesión OPEN): tarjeta `info-container`, una línea: «Conteo #N en curso · contados/total · alcance». Sin botón (el CTA del header ya es «Continuar»).

**Tarjeta «Ciclo · {plazo} días»:**

- Etiqueta + `ⓘ` con tooltip «Ciclo móvil».
- Cifra grande `NN %` («verificado») + **`CoverageBar`**: barra de 12 px de alto, radio 6, segmentos con gap 2 px y `flex` proporcional: al día (success) · por vencer (warning) · vencidos (error) · nunca contados (`outline-variant`). Cada segmento con tooltip («Al día: 11 · Contado dentro del 75 % del plazo»). Transición de `flex` 300 ms.
- Leyenda con punto + cantidad («11 al día · 3 por vencer · 15 vencidos · 4 nunca») y a la derecha «Último ciclo completo: {fecha}» (ver pregunta abierta 17.5).
- **Franja de atajos**, separada por un borde superior: etiqueta «ATAJOS SOBRE TODO EL INVENTARIO» con `ⓘ`, y dos botones secundarios: «Más atrasados · N» y «Nunca contados · n». **Importante (feedback de Nanez):** los atajos operan **sobre todo el inventario**, no dentro de la marca o proveedor seleccionado; por eso viven en esta tarjeta y no junto a la tabla.

**Tarjeta de tabla de cobertura:**

- `SegmentedToggle` de dimensión: **Marca | Proveedor | Tipo** (con tooltips) y a la derecha la nota «Marca filas para armar un conteo». Cambiar de dimensión **limpia la selección** (así nunca se cruzan dimensiones).
- Columnas (grid): `[checkbox 28px] [Nombre 1.3fr] [Ítems .5fr] [Verificado: barra 8 px navy sobre surface-container 1.2fr] [% .5fr] [Antigüedad 1.3fr] [semáforo 30px] [Mov. .6fr]`. Filas con padding vertical 12, borde superior `surface-container`, hover `surface-container-low`, **toda la fila es clicable** (alterna el checkbox).
- Cabeceras con tooltip: «Ítems», «Verificado», «Antigüedad» («mediana de días desde el último conteo»), «Mov.» («movimientos desde el último conteo»).
- Antigüedad del grupo = **mediana** de la antigüedad de sus ítems contados; texto «mediana hace 45 d» o «nunca». Semáforo del grupo según esa mediana (gris si ningún ítem fue contado).
- **Barra de selección fija abajo** (aparece al marcar): navy, radio 12, «N seleccionados · M ítems», `Limpiar`, botón dorado «Contar selección →» (abre Nuevo conteo con lo marcado ya cargado). Animación de entrada 220 ms.
- **Teléfono**: cada fila es una tarjeta (flex-wrap), encabezados ocultos, la barra de selección se ancla abajo.
- **Estados**: vacío (sin ítems elegibles), cargando (skeleton de la tarjeta y de las filas, no spinner suelto), error (caja `error-container` con reintento).

### 7.2 `/inventory/count` · Pestaña **Historial**

Lista de conteos (más reciente primero): `Conteo #N · alcance · estado · cuándo · «Ver informe →»` (texto en `#1e4f5e`). **Toda la fila abre el informe** de esa sesión (aplicada o cancelada). Filtros (estado, fecha) y paginación/servidor si hay muchas sesiones. Estado vacío con `EmptyState`.

### 7.3 Panel **Nuevo conteo** (`SlideOver`, ancho `min(500px, 100%)`, pantalla completa en teléfono)

Estructura: cabecera (título 19 px + ✕) · cuerpo con scroll interno **del panel** · pie fijo (Cancelar / Iniciar conteo dorado).

Contenido, en este orden:

1. **«¿Qué vas a contar?»** + `ⓘ`. `SegmentedToggle`: **Todo | Marca | Proveedor | Tipo**.
2. **Si «Todo»:** tres tarjetas de opción (radio, `aria-pressed`), cada una con título, explicación corta y conteo a la derecha: «Todo el inventario» · «Los N más atrasados» · «Solo nunca contados». **Estos atajos solo aparecen bajo «Todo»** (en Marca/Proveedor/Tipo desaparecen: Nanez los confundió con filtros combinables).
3. **Si Marca / Proveedor / Tipo:** **combobox multiselección** (ver 11.2): input con búsqueda dentro de una caja con **etiquetas quitables** (✕) y dropdown con **checkbox por opción**, nombre, «n ítems» y punto de semáforo de la opción. Teclado: escribir filtra, ↓ entra a la lista, Enter alterna, Backspace con input vacío quita la última, Esc cierra el dropdown (sin cerrar el panel).
4. **«Responsables del conteo»** + `ⓘ`: **mismo combobox**, con dos tipos de entrada: **usuarios del sistema** (lista) y **personas externas** (texto libre: si lo escrito no coincide con un usuario aparece «＋ Agregar «Juan Márquez» como persona externa»). Etiquetas: usuario = navy; externo = `warning-container` con sufijo «· externo». Tooltips: usuario «puede ver e interactuar con el conteo»; externo «solo queda registrada en el informe». El usuario que crea el conteo viene preseleccionado.
5. **Vista previa viva** (caja `info-container`): «N ítems · k con stock 0 · más antiguo: hace X d». Se recalcula en cada cambio.
6. **Notas** (opcional, ≤ 500).

**Botón «Iniciar conteo»:** deshabilitado (`aria-disabled`, con tooltip que dice por qué) si no hay ítems en el alcance **o** no hay al menos un responsable.

### 7.4 Panel **Ajustes del ciclo** (solo ADMIN/MANAGER)

Dos campos globales: **Plazo del ciclo (días)** (default 30) y **Umbral de diferencia (unidades)** (default 2), cada uno con `ⓘ`. Nota fija breve: «Verde hasta 75 % del plazo, ámbar hasta 100 %, rojo después». Se guardan al pulsar «Listo»; la Cobertura se recalcula en vivo.

### 7.5 Sesión `/inventory/count/[id]` · Cabecera

- **Barra navy** (padding 8/16/8/26, con las dos barras diagonales a la izquierda): `←` (tooltip «Guardar y salir: el progreso se guarda por línea») · título «Conteo #N · alcance» (Space Grotesk 15 px/700, blanco) · **pila de avatares** de responsables (ver 7.9) · **stepper** `1 Contar · 2 Revisar · 3 Cerrar` (activo: fondo `brand-blue` texto navy; inactivos `#aab4cf`; cada uno con tooltip) · espacio · progreso «contados/total» + barra 90×6 (track `#38466b`, relleno azul, transición 250 ms) · **CTA dorado de fase** · `⋯` (solo ADMIN/MANAGER) → «Cancelar conteo».
- **CTA de fase**: ① «Revisar →» (deshabilitado con tooltip «Faltan N por contar» hasta que no queden pendientes con stock > 0) · ② «Cerrar conteo» (deshabilitado con tooltip «Faltan N recuentos») · informe: «Volver a cobertura». Para quien no es ADMIN/MANAGER el botón aparece deshabilitado con tooltip «Solo ADMIN o MANAGER». **Usa `aria-disabled` y no `disabled`** en botones que explican su estado, para que el tooltip funcione y se anuncie.
- **Franja de resumen** (una línea, sobre el cuerpo): «Pendientes · Coinciden · Con diferencia (−x / +y) · Impacto est. · Stock 0 sin confirmar», cada dato con tooltip. En ≥ 1600 px pasa a la columna derecha.
- **Banner solo lectura** (SELLER no asignado): barra `warning-container` «Estás viendo este conteo en solo lectura» con tooltip «Pide a un ADMIN o MANAGER que te agregue»; todos los inputs deshabilitados.

### 7.6 Fase ① **Contar** (escritorio): la «hoja de conteo»

**Toolbar** (padding 10/12, borde inferior): `SegmentedToggle` de filtro **Todos | Pendientes | Con dif. | Stock 0** · buscador (nombre/SKU, tecla `/`) · botón `⌨` con tooltip de atajos (en teléfono: toggle Ficha | Lista).

**Cabecera de columnas** (34 px, `surface-container-low`, fuera del scroll): Ítem · **Sistema** (tooltip: «Stock del sistema: es una foto al abrir el conteo; no cambia aunque haya ventas durante el conteo») · **Contado** · **Dif.** (tooltips).

**Cuerpo (`rows`, único scroll):**

- **Agrupado por marca**, orden marca → nombre. Cabecera de grupo **sticky**: «RAY-BAN · 12/34» (12 px, 700, uppercase, `surface-container-low`) con progreso por grupo.
- **Fila de 50 px**, grid `[26px estado][1fr nombre+SKU][70px sistema][110px contado][110px dif]`, gap 10, borde inferior `surface-container`:
  - **Estado** (icono, tooltip con título+cuerpo): pendiente `Circle` gris · coincide `Check` success · sobra `ArrowUp` · falta `ArrowDown` (warning bajo umbral, error sobre umbral) · ajustado `CheckCheck` en `#1e4f5e`.
  - **Nombre** en una línea + SKU en mono 12 px `outline`; truncado con elipsis.
  - **Sistema** a la derecha, `tabular-nums`.
  - **Contado**: `<input inputmode="numeric">`, 96 px, 16 px/700, alineado a la derecha, radio 8, borde `outline-variant`; solo dígitos, máx. 4.
  - **Dif.**: badge solo si ≠ 0: `▲ +1 sobra` / `▼ −2 falta` (la palabra «sobra/falta» solo en ≥ lg). Fondo/texto warning bajo umbral y error sobre umbral. Tooltip: «Sobran 1 · El sistema dice 6; contaste 7».
  - **Fila con foco** (`:focus-within`): fondo `info-container` + barra interior izquierda 3 px `brand-blue` (el «cursor»).
- **Grupo «Stock 0 · N ítems»** al final, **colapsado** (grid-rows 0fr→1fr, 250 ms, `inert` cuando está cerrado). Cabecera con botón «Confirmar los N en 0» (marca como contados en 0 los que siguen sin contar). Cada ítem de stock 0 se puede sobrescribir tecleando. Con el filtro «Stock 0» el grupo se muestra abierto.
- Los ítems **ya contados se atenúan pero no desaparecen** (el cursor no se mueve de sitio). Con el filtro «Pendientes» las filas contadas sí salen de la lista.
- **Estado vacío del filtro/búsqueda:** «Sin resultados · Prueba otra búsqueda o cambia el filtro» (no el texto actual «registra conteos»).

**Rendimiento:** la lista puede tener miles de filas. **Virtualiza/ventanea** (ver 17.9) manteniendo el cursor de teclado y el foco.

### 7.7 Fase ① **Contar** (teléfono): la **ficha**

Pantalla completa dentro del área de contenido: etiqueta «MARCA · k de n» · nombre (20 px) · SKU mono · «SISTEMA» + número **56 px** · «CONTADO» + input **36 px** de 160 px de ancho (radio 12, centrado, `inputmode="numeric"`, `enterkeyhint="next"`) · dos botones en fila de igual ancho y alto ≥ 48: **«← Anterior»** (secundario) y **«Guardar y siguiente»** (dorado) · «N pendientes». Guardar salta al **siguiente pendiente**; si no hay, avanza un ítem. El toggle **Ficha | Lista** permite saltar a un ítem concreto (la Lista usa la misma hoja de 7.6 en compacto). Orden: ítems con stock > 0 primero, stock 0 al final.

### 7.8 Fase ② **Revisar**

- Cabecera de la lista: «Diferencias por impacto» + `ⓘ`; a la derecha **selector de motivo en lote** (default visible, ver 12.6) y botón secundario **«Aplicar todo (N)»** con tooltip: «Ajusta el stock de las N diferencias menores a {umbral} unidades con el motivo elegido. Las que superan el umbral se ajustan una por una tras recontar». Deshabilitado si N = 0.
- Filas (grid `[26px][1fr][160px][110px][80px][190px]`), ordenadas por |diferencia × costo| descendente: estado · nombre+SKU · «Sistema 5 → 4» · badge de diferencia · **impacto USD** (tooltip «4 u × costo $90») · **acción**:
  - Si |dif| ≥ umbral y no recontada → **input «Recontar»** (Enter guarda y recalcula; tooltip «Recuento obligatorio»).
  - Si ya recontada o bajo umbral → botón **«Ajustar»** (abre el panel 7.10; si fue recontada: «Recontado · Ajustar»).
  - Si ya ajustada → «✔✔ Ajustado».
- **Ajustar no bloquea el cierre.** Lo que sí bloquea el cierre: recuentos obligatorios pendientes (y pendientes de fase ①).
- Vacío: «Sin diferencias · Todo coincide con el sistema».

### 7.9 Responsables (avatares y edición)

- **Pila de avatares** en la cabecera (círculos de 26 px con iniciales, borde navy 1,5 px, solapados −6 px, hasta 3 + «+N»). Tooltip: «Responsables: nombre (externo)…».
- **Para ADMIN/MANAGER y mientras el conteo está abierto**, la pila es un **botón** (con un último círculo «＋» como pista) que abre el panel lateral **«Responsables del conteo»**: el mismo combobox de 7.3 sobre los responsables **actuales**; los cambios se aplican al pulsar «Listo» (aviso «Responsables actualizados»). Nota del panel: «Quitar a alguien no borra lo que ya contó». Para los demás roles o en el informe, la pila es solo informativa.

### 7.10 Panel **Ajustar stock** (dentro de la sesión)

Ítem (nombre + SKU) · caja resumen «Entrada/Salida de N u · ±$X» (warning si entrada, error si salida) · **Motivo** (select con los **motivos del repo** + **«Otros»**; con «Otros» aparece un campo de texto **obligatorio**) · texto «se vincula un movimiento a esta línea» · pie: Cancelar / **Aplicar ajuste** (dorado). **Cantidad y dirección prellenadas** desde la diferencia final. Reutiliza la lógica de ajuste manual (12.6), incluida su confirmación por pérdida financiera si aplica.

### 7.11 Fase ③ **Informe** (también para sesiones del historial; solo lectura)

- Título «Informe #N · alcance». Avatares de responsables. Sin stepper ni CTA de fase.
- **Cuatro KPIs** (grid de 4, tarjetas `surface-container-low` radio 10, valor 26 px, cada una con tooltip): Contados · Coinciden · Diferencias («faltan x u y sobran y u») · Impacto est.
- Línea: **«Cobertura del ciclo: 42 % → 61 %»** (antes → después), fechas inicio → cierre, responsables (usuarios navy / externos `warning`, con tooltip).
- **«Qué se movió»**: `SegmentedToggle` **Por marca | Por proveedor | Por tipo** y tabla `[grupo][Contados][Coinciden][Sobran][Faltan][Ajustes x/y][Impacto con mini-barra]`. **Es el resumen rápido de cuánto cambió todo.**
- Acciones: **Imprimir** (`window.print()` con estilos `@media print` dedicados, sin shell), **PDF** (preferible vía impresión del navegador si no hay librería; ver 17.12) y **Excel**.
- **Detalle de diferencias** (lista con estado, «Sistema → Contado», badge, impacto, «Ajustado / Ajuste pendiente»).
- **Sesión cancelada:** informe mínimo (motivo, alcance, ítems contados, responsables). **Sin** dashboard de ceros ni tabla vacía.

### 7.12 Cancelar conteo

Solo ADMIN/MANAGER, desde `⋯`. Panel (o `ConfirmModal` con textarea, lo que encaje mejor en el kit) con motivo obligatorio (mín. 5 caracteres, validado en cliente y Zod), botón rojo «Confirmar cancelación». Al confirmar: la sesión queda `CANCELLED`, vuelve a Cobertura con toast.

---

## 8. Comportamiento y teclado

**Semáforo (por ítem):**

- `antigüedad = días desde lastCountedAt` (último conteo **cerrado** que verificó el ítem).
- **Al día (verde)** ≤ 75 % del plazo · **Por vencer (ámbar)** > 75 % y ≤ 100 % · **Vencido (rojo)** > plazo · **Nunca contado (gris, anillo vacío)** si no hay `lastCountedAt`.
- **Reconciliación con la decisión «ítem nuevo nace verde»:** si no hay `lastCountedAt` y el ítem fue creado hace ≤ 75 % del plazo, se muestra **verde con tooltip «Nuevo, aún no le toca»**; pasado ese margen sin conteo, pasa a gris «nunca contado». (Es la propuesta por defecto; ver pregunta 17.1.)
- **Verificado %** del grupo = ítems con `lastCountedAt` dentro del plazo ÷ ítems del grupo.
- **Ventas, compras y ajustes manuales NO reinician la antigüedad** (no verifican el físico). Sí alimentan la columna **«Mov. desde el último conteo»**.
- **Un ítem queda verificado solo si:** estuvo en una sesión `APPLIED` y fue contado (o confirmado en 0). Sesiones abiertas o canceladas no cuentan.

**Clasificación de diferencia:** `d = (recuento ?? conteo) − systemStock`. `d = 0` → coincide. `0 < |d| < umbral` → ámbar. `|d| ≥ umbral` → rojo **y** exige recuento antes de cerrar. El signo se muestra siempre con flecha y palabra; el color mide gravedad, no «bueno/malo» (un sobrante no es una buena noticia).

**Teclado (escritorio, fase ①):**

| Tecla     | Acción                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `↑` / `↓` | Mover el cursor entre inputs visibles (se saltan los colapsados)                                                                 |
| Dígitos   | Escriben en el input enfocado                                                                                                    |
| `Enter`   | Guarda la línea y salta al **siguiente pendiente** (por debajo; si no hay, no se mueve)                                          |
| `Esc`     | Revierte el valor y sale del input; cierra el panel lateral si está abierto; si hay un dropdown abierto, cierra solo el dropdown |
| `/`       | Enfoca el buscador (si no se está escribiendo en otro campo)                                                                     |

Combobox: ver 7.3. Formateo/saneado: solo dígitos, máx. 4. **Guardado por línea** (al `change`/Enter), optimista con rollback y toast de error.

**Estado en URL** (resuelve «los filtros se pierden al refrescar»): `?tab=his`, `?dim=brand`, y en la sesión `?f=pend&q=…`. Preferible `$page.url` + `replaceState`.

**Concurrencia y varios usuarios:** varios responsables pueden estar en la misma sesión. Ver 17.10.

---

## 9. Tooltips (hay que explicar casi todo)

**Requisito de Nanez:** reutilizar el tooltip propio del app (`InfoTooltip` y `TriggerTooltip`) y **ampliarlo** para que al pasar el cursor por casi cualquier elemento se explique. Cubrir: pestañas, dimensiones, cabeceras de columna, semáforos, segmentos de la barra, atajos, filtros, buscador, estados de fila, diferencia, impacto, botones deshabilitados (explican el porqué), pasos del stepper, avatares, etiquetas de responsables, resumen, exportes, y los `ⓘ` junto a las etiquetas de conceptos (ciclo, alcance, responsables, plazo, umbral).

**Variantes que el mockup necesita (verifica cuáles ya existen):**

- **Título + cuerpo** (negrita arriba, descripción abajo, `max-width ≈ 280 px`, 13 px).
- **Colocación automática:** arriba por defecto, **se voltea abajo si no cabe** y **se acota dentro del contenedor**. En el mockup v1 un tooltip se recortaba por `overflow: hidden`; el actual es un único elemento flotante fuera de los contenedores con scroll. **Renderiza el tooltip en un portal / capa superior** para no recortarse.
- Disparo por **hover y foco** (`tabindex="0"` en elementos informativos no interactivos).
- Variante **sobre elementos deshabilitados** (con `aria-disabled`) y sobre iconos.

**Copy:** los textos exactos están en el mockup (`data-tip="Título|Cuerpo"`). Extráelos de ahí; si cambias un texto, avisa.

---

## 10. Transiciones

| Qué                                       | Cómo                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cobertura ↔ sesión ↔ informe              | Entrada direccional (`translateX(12px)` + fade, 220 ms, easing del sistema)                             |
| Panel lateral                             | `transform` 250 ms + overlay fade 200 ms; al cerrar, `visibility` retrasado para no cortar la animación |
| Grupo «Stock 0»                           | `grid-template-rows` 0fr↔1fr, 250 ms, `inert` cerrado                                                   |
| Barra de progreso (sesión)                | `width` 250 ms                                                                                          |
| Barra de cobertura / barras de verificado | `flex`/`width` 300 ms                                                                                   |
| Barra de selección                        | entrada 220 ms                                                                                          |
| Hover de fila y botones                   | 150 ms                                                                                                  |
| Toasts                                    | `svelte-sonner` (el mockup usa uno propio por simplicidad)                                              |

`prefers-reduced-motion`: sin transiciones ni animaciones.

---

## 11. Componentes

### 11.1 Reutilizar del kit (verificar API)

`PageHeader`, `Button`, `Card`, `SegmentedToggle` (pestañas, dimensiones, filtros, Ficha|Lista, Por marca|proveedor|tipo), `SlideOver` (todos los paneles), `ConfirmModal` (cancelar, si encaja), `DataGrid` (Cobertura e Historial, si soporta lo necesario), `EmptyState`, `Tooltip` (InfoTooltip/TriggerTooltip), `Badge*` (estado de sesión), `WizardHeader` (stepper, si su estilo se adapta al header navy; si no, custom), `SearchCombobox`.

### 11.2 Ampliar

- **`SearchCombobox` → modo multiselección**: etiquetas quitables dentro del input, checkbox por opción, metadatos por opción (subtexto «n ítems», punto de semáforo), acción de pie opcional («＋ Agregar «…» como persona externa»), teclado completo (↓, Enter, Backspace, Esc), `aria-multiselectable`, anuncios de selección. **Nanez confirmó que el input-select actual no tiene checkboxes y puede ampliarse como aditivo.** Se usa para marcas, proveedores, tipos y responsables.

### 11.3 Crear (si el kit no los cubre; **confírmalo antes**)

`CoverageBar` (barra segmentada con tooltips), `TrafficDot` (punto de semáforo + gris anillo), `CountSheet` + `CountRow` (hoja con cursor de teclado y virtualización), `CountCard` (ficha móvil), `DiffBadge`, `ResponsibleStack` (avatares), `ReportBreakdown` (tabla por marca/proveedor/tipo), `CoverageGroupRow`. Cada uno en su archivo, sin barrels, sin duplicar clases (extrae componentes para etiquetas uppercase, chips, tarjetas).

### 11.4 Qué reemplazar del módulo actual

`CountListHeader`, `CountListMetrics` (las 4 tarjetas desaparecen), `CountHistoryTable`, `CountCreateModal` (modal a mano → `SlideOver`, con focus trap), `CountSessionHeader`, `CountSummaryMetrics`, `CountLinesTable`, `CountLineMobileCard`, `CountLineEditRow`, `CountActionModals`. Los helpers `countSummary.ts`, `countList.ts`, `countAdjustments.ts` se reescriben/adaptan con sus specs.

---

## 12. Cambios de modelo, estado y servidor que pide la UI

> Son **necesidades** derivadas del diseño. La forma concreta (columnas, tablas, índices) la decides tú contra el esquema real; si discrepas de la propuesta, dilo. **Nanez acepta cambios de base de datos.**

### 12.1 Cobertura por ítem

Necesidad: saber, para cada producto/lente, **cuándo fue su último conteo cerrado** y en qué sesión. Propuesta: `lastCountedAt` + `lastCountSessionId` desnormalizados en `products` y `lensCatalogItems`, actualizados **en la transacción de `applySession`** (solo líneas contadas o confirmadas en 0), con **backfill** desde sesiones `APPLIED` existentes. Alternativa: derivar con una consulta sobre líneas de sesiones `APPLIED` (justificar con rendimiento). Agregados necesarios por **marca, proveedor y tipo**: nº ítems, % verificado, mediana de antigüedad, movimientos desde el último conteo (`inventory_movements` con fecha posterior), conteos por estado de semáforo, nº nunca contados.

### 12.2 Configuración global del ciclo

Valores globales editables por ADMIN/MANAGER: `cycleDays` (default 30), `diffThresholdUnits` (default 2). Ubicación (tabla de settings existente u otra) la decides tú. El 75 % del semáforo es constante salvo que indiques lo contrario (pregunta 17.3).

### 12.3 Alcance estructurado de la sesión

Reemplazar/ampliar `scopeType`/`scopeValue` por: dimensión (`ALL` | `BRAND` | `SUPPLIER` | `TYPE` | `QUICK_OLDEST` | `QUICK_NEVER`) + lista de valores (ids de marca, proveedor o tipos) + (para `QUICK_OLDEST`) el N. **Mantener compatibilidad** con sesiones antiguas (`ALL`, `PRODUCT_CATEGORY`, `LENS`). Las reglas de elegibilidad **no cambian** (no borrados, `stock > 0` o con movimientos; lentes solo `inventoryMode = 'STOCK'`).
**Lentes por proveedor:** hoy casi no hay lentes con stock, pero el modelo y el filtro por proveedor **deben quedar abiertos** para incluir lentes cuando existan (si `lensCatalogItems` tiene proveedor). **La UI no expone nada específico de lentes por ahora** (WIP).
Mapeado a futuro, **sin UI ni modelo ahora:** ubicaciones físicas, varias sesiones simultáneas.

### 12.4 Vista previa de alcance

Consulta ligera `previewScope(alcance)` → `{ total, zeroStock, oldestAgeDays, neverCounted }`, invocada al cambiar el alcance (con debounce) desde el panel.

### 12.5 Responsables

Tabla de participantes por sesión: `sessionId`, `userId` (nullable), `displayName` (para personas externas o snapshot del nombre), `addedById`, `addedAt`, `removedAt` (**baja lógica**, para no perder trazabilidad: quitar a alguien no borra lo que contó). El creador se agrega automáticamente. **Regla de acceso a una sesión abierta:** ADMIN/MANAGER siempre; un usuario no admin solo si es participante activo; otros ven solo lectura. Comandos: agregar/quitar responsables (solo ADMIN/MANAGER, solo sesión `OPEN`). `countedById` de cada línea se conserva.

### 12.6 Recuento y ajuste vinculado

- **Recuento:** conservar el primer conteo y el recuento (`recountStock`, `recountedById/At`); la diferencia se calcula sobre el valor final (`recuento ?? conteo`). Cambiar el conteo limpia el recuento y el ajuste (invariante 4).
- **Ajuste dentro de la sesión:** comando `applyLineAdjustment(lineId, motivo, texto?)` y `applyAdjustmentsBatch(sessionId, motivo, texto?)` (solo líneas bajo umbral, sin ajuste y sin recuento pendiente). **Reutilizan la lógica de ajuste manual existente** (lotes FIFO, confirmación por pérdida) y **vinculan el `inventory_movement` creado a la línea** (p. ej. `adjustmentMovementId`), de modo que «Ajustado» significa «existe el movimiento». Las sesiones antiguas conservan `adjustmentCompleted`.
  > **Actualización 2026-11-10:** el ajuste se **solicita** en Revisar (`requestLineAdjustmentCmd`, `adjustment_requested_by/at`, sin movimiento) y el movimiento se crea **al cerrar** dentro de la transacción de `applySession`; cancelar la sesión descarta lo solicitado y `clearLineAdjustmentCmd` permite des-marcar una línea mientras siga OPEN.
- **Motivos:** usar la lista de motivos que ya existe en el repo + **«Otros»** con texto libre obligatorio (se guarda el texto).
- Permisos de ajuste: ADMIN/MANAGER (ver 17.7 sobre lentes).

### 12.7 Cierre

`applySession` (ADMIN/MANAGER) con la **nueva regla** de la sección 3. Debe: calcular totales (incluidos sobran/faltan/impacto), **fijar `lastCountedAt`** en los ítems verificados, guardar **cobertura antes/después** (o permitir calcularla: se registra `coverageBefore` al abrir y `coverageAfter` al cerrar) y marcar fecha/usuario. Las líneas de stock 0 sin confirmar quedan sin `lastCountedAt`.

### 12.8 Informe y exportes

Consulta agregada por **marca/proveedor/tipo** para una sesión: contados, coinciden, sobran, faltan, impacto (diferencia × costo), ajustes aplicados/total. Los datos del informe de una sesión cerrada deben ser **estables** (no depender del stock vivo).

### 12.9 Lectura y escritura eficientes

- `upsertCountLine` **no debe recargar todas las líneas** de la sesión: devuelve solo la línea actualizada.
- La sesión debe cargar sus líneas de forma paginada/ventaneada o con una consulta eficiente (hoy 5 joins por 674+ líneas).
- La sesión activa sigue cargándose en el layout, pero **sin joins innecesarios**.

### 12.10 Estado del cliente (Svelte 5)

Contexto de sesión activa existente se conserva. Estado local con runes por vista: selección de la tabla de cobertura, alcance en construcción, responsables en edición, filtro/búsqueda/modo (Ficha|Lista), cursor de fila, ítems en vuelo. Estado compartido relevante en URL (sección 8).

---

## 13. Accesibilidad

- Paneles laterales y modales con **focus trap, foco inicial, `Esc` y retorno de foco** (hoy son overlays a mano sin trap: usar `ui/dialog`/`SlideOver`).
- Contraste ≥ 4.5:1 en texto (ver 4.1); foco visible (anillo `brand-blue` 2 px) en todo elemento interactivo; todo el flujo principal **usable solo con teclado**.
- Botones que explican su estado: `aria-disabled` + `aria-describedby` al texto del tooltip.
- Combobox con roles ARIA (`combobox`, `listbox`, `option`, `aria-selected`), anuncios (`aria-live="polite"`) al agregar/quitar.
- Estados por **icono + texto/tooltip**, no solo color. Los iconos puramente decorativos con `aria-hidden`.
- Inputs de conteo con `aria-label` («Contado {ítem}»). Progreso con `role="progressbar"` y valores.
- Objetivos táctiles ≥ 44 px en teléfono. Respeta `prefers-reduced-motion`.

---

## 14. Estados y casos borde (diseñarlos, no solo el camino feliz)

Vacío (sin ítems elegibles, sin historial, sin diferencias, sin resultados de búsqueda), cargando (skeletons), error (caja con reintento; fallo de guardado de línea con rollback visible), sin permisos (solo lectura / botones con motivo), sesión abierta que otro usuario cierra o cancela mientras estoy contando, ítem con stock 0 que se cuenta distinto de 0, conteo con **un solo responsable externo** (nadie del sistema asignado: solo ADMIN/MANAGER operan), varios responsables guardando la misma línea (17.10), pérdida de conexión en teléfono (reintento visible; **modo sin conexión fuera de alcance**), nombres de marca/proveedor muy largos (truncado + tooltip), 2.000+ ítems.

---

## 15. Fases y criterios de aceptación

> Cierra cada fase con `pnpm lint && pnpm test` en verde, resumen y capturas/GIF cuando aplique. No avances sin cerrar la anterior.

**Fase 0 · Verificación (sin código de producto)**

- Responder la sección 17 (lo que se pueda contra el código) y listar lo que requiere decisión de Nanez.
- Inventariar qué componentes del kit existen/alcanzan (sección 11).
- **Aceptación:** documento breve de hallazgos y propuesta de ajustes; Nanez aprueba antes de la fase 1.

**Fase 1 · Datos y servidor**

- Migraciones + backfill (12.1–12.6), nuevas queries (cobertura agregada, previewScope, informe por dimensión) y remote functions con Zod y guards de rol/participante, nueva regla de cierre, ajuste vinculado, `upsertCountLine` ligero.
- **Aceptación:** migración corre limpia con backfill verificable; tests de integración para: regla de cierre (cierra con stock 0 sin confirmar; bloquea con recuentos pendientes), `lastCountedAt` solo en verificados, acceso por participante/rol, ajuste vincula movimiento, agregados por marca/proveedor/tipo con datos conocidos; tests existentes actualizados.

**Fase 2 · Cobertura + Nuevo conteo + Ajustes del ciclo**

- Pestañas, tarjeta de ciclo, `CoverageBar`, atajos, tabla por dimensión con selección, barra de selección, Historial (lista), panel Nuevo conteo (con `SearchCombobox` multiselección, vista previa, responsables), panel Ajustes del ciclo, estados vacío/cargando/error, URL state.
- **Aceptación (verificable):** en 1280×720 la Cobertura muestra ciclo + atajos + ≥ 4 filas de la tabla sin scroll de página extra; seleccionar 2 marcas → «Contar selección» abre el panel con ambas cargadas y la vista previa correcta; los atajos **no** aparecen con Marca/Proveedor/Tipo; no se puede iniciar sin ítems o sin responsables (con tooltip); crear el conteo navega a la sesión; textos ≥ al piso de 4.2.

**Fase 3 · Sesión: Contar (escritorio)**

- Cabecera navy, stepper, resumen, toolbar, hoja agrupada, cursor de teclado, grupo Stock 0 colapsado + confirmar en lote, filtros, búsqueda, columna lateral ≥ 1600, estado en URL, virtualización, guardado por línea con rollback.
- **Aceptación:** contar 20 ítems seguidos usando **solo teclado** (dígitos + Enter) sin tocar el ratón; el cursor salta al siguiente pendiente; en 1280×720 se ven ≥ 9 filas; no hay scroll anidado; con 2.000 ítems de prueba el scroll se mantiene fluido; Esc revierte; «Confirmar los N en 0» funciona y no bloquea el cierre.

**Fase 4 · Sesión: teléfono**

- Ficha, Ficha|Lista, tarjetas de Cobertura, panel completo, objetivos táctiles.
- **Aceptación:** en 390×844 se cuenta un ítem con teclado numérico y «Guardar y siguiente» en un gesto; paridad de datos/reglas con escritorio; todo usable con el pulgar.

**Fase 5 · Revisar, recuento, ajuste y cierre**

- Fase ② (lista por impacto, recuento obligatorio, «Aplicar todo (N)» con motivo en lote, panel de ajuste con motivos del repo + «Otros»), regla de cierre, cancelar.
- **Aceptación:** no se puede cerrar con recuentos pendientes (tooltip explica); «Aplicar todo (N)» muestra el default de motivo y exige texto con «Otros»; cada ajuste crea un movimiento vinculado a la línea; un SELLER ve los CTAs deshabilitados con «Solo ADMIN o MANAGER».

**Fase 6 · Informe, Historial, impresión y exportes**

- Informe con KPIs, cobertura antes→después, desglose por marca/proveedor/tipo, detalle; informe de sesiones anteriores y canceladas; imprimir; PDF; Excel.
- **Aceptación:** abrir cualquier sesión del Historial muestra su informe estable; el desglose coincide con los totales; «Imprimir» produce una hoja limpia sin shell; exportes descargan datos correctos (ver 17.12 para la librería).

**Fase 7 · Responsables, permisos y pulido**

- Edición de responsables en sesión activa (panel con ＋), matriz de roles completa, recorrido de accesibilidad y teclado, ajuste fino visual contra el mockup en 1280×720 / 1920×1080 / 390×844, refresco/concurrencia (17.10), pasada de tooltips.
- **Aceptación:** matriz de roles probada (sección 16); un SELLER asignado cuenta pero no revisa/cierra; uno no asignado solo lee; ningún botón lleva a un redirect silencioso; auditoría a11y sin hallazgos críticos; Nanez aprueba con capturas.

---

## 16. Roles y permisos (matriz objetivo)

| Acción                                     | ADMIN | MANAGER | SELLER asignado | SELLER no asignado |
| ------------------------------------------ | ----- | ------- | --------------- | ------------------ |
| Ver Cobertura / Historial / informes       | ✅    | ✅      | ✅              | ✅                 |
| Crear conteo                               | ✅    | ✅      | ✅ (ver 17.8)   | ✅ (ver 17.8)      |
| Contar / editar líneas, confirmar stock 0  | ✅    | ✅      | ✅              | ❌ (solo lectura)  |
| Revisar, recontar, ajustar, «Aplicar todo» | ✅    | ✅      | ❌              | ❌                 |
| Cerrar / cancelar                          | ✅    | ✅      | ❌              | ❌                 |
| Editar responsables                        | ✅    | ✅      | ❌              | ❌                 |
| Ajustes del ciclo (plazo, umbral)          | ✅    | ✅      | ❌              | ❌                 |

La UI **solo ofrece lo permitido** o lo muestra deshabilitado **con tooltip del motivo**; no quedan enlaces que terminen en redirect al dashboard. Guards en `load` y en cada remote function.

---

## 17. Preguntas abiertas: verifica contra el código y la lógica de negocio

> Contesta con lo que encuentres. Lo que sea decisión de producto, déjalo marcado para Nanez, con tu recomendación.

1. **Semáforo y «ítem nuevo»:** ¿existe `createdAt` en productos y lentes? Confirmar la regla por defecto de la sección 8 (verde si es nuevo y está dentro del 75 % del plazo; gris «nunca contado» después). **Decide Nanez.**
2. **Costo por ítem** para «Impacto est.»: ¿qué campo usa hoy la pantalla de ajuste para estimar la pérdida (costo promedio, costo del lote FIFO, precio)? Definir cuál se usa en Revisar e Informe.
3. **Constantes:** el 75 % del semáforo, ¿fijo o configurable? El **N de «los más atrasados»** (el mockup usa 12 porque su set de demo tiene 33 ítems; con ~674 propongo **50**): ¿fijo, configurable en el panel o por conteo? **Decide Nanez.**
4. **Umbral en USD:** Nanez pidió umbral «de unidades y/o USD». El mockup solo tiene unidades. ¿Agregamos umbral en USD (OR con unidades)? **Decide Nanez.**
5. **«Último ciclo completo»:** el mockup muestra una fecha inventada. Definir cómo se calcula (propuesta: la fecha del cierre en que, por primera vez, el 100 % de los ítems elegibles quedó verificado dentro del plazo) y si se registra al cerrar.
6. **Motivos de ajuste:** ubicar la lista del repo y cómo se mapea a «Otros» (¿tipo + texto libre?).
7. **Permisos de ajuste de lentes:** hoy solo ADMIN puede ajustar lentes y MANAGER es redirigido. Con ajuste dentro de la sesión y el criterio «MANAGER puede ajustar», ¿se alinea el permiso de lentes a ADMIN+MANAGER? Hoy hay 0 lentes con stock, riesgo bajo. **Decide Nanez.**
8. **Crear conteo:** ¿SELLER puede crear conteos (hoy sí)? Mantener salvo indicación.
9. **`DataGrid` y virtualización:** ¿soporta ventaneo, cursor de teclado e inputs por fila? Si no, la hoja será un componente nuevo; indica el costo. También si `SearchCombobox` admite multiselección y qué alcance tiene ampliarlo.
10. **Concurrencia y «tiempo real»:** varios responsables en la misma sesión: ¿last-write-wins por línea basta? ¿Mostrar quién contó cada línea (`countedById` ya existe) y avisar si otro modificó la línea? ¿Refresco por `visibilitychange`/intervalo corto (sin websockets)? Proponer lo mínimo razonable.
11. **Tooltip propio:** qué variantes existen hoy (portal, título+cuerpo, flip, foco, sobre deshabilitados) y qué hay que añadir.
12. **Exportar:** ¿hay en el repo alguna librería para Excel/CSV/PDF? **No agregues dependencias**: si no existe, propone (a) PDF por impresión del navegador y (b) CSV compatible con Excel (BOM UTF-8), o dime qué librería necesitarías y por qué.
13. **Hoja de conteo imprimible** (lista de ítems del alcance por marca con columna de conteo en blanco, con o sin stock del sistema): no está en el mockup; confirma con Nanez si entra en Fase 6 y en qué formato.
14. **Edición de responsables:** ¿la baja lógica basta o hace falta mostrar historial de quién estuvo y cuándo?
15. **Sesiones del Historial anteriores a este cambio:** ¿qué muestra su informe si no tienen `coverageBefore/After`, sobran/faltan o el desglose (se recalcula desde las líneas o se omite)?
16. **Lentes:** ¿`lensCatalogItems` tiene proveedor para el filtro por proveedor? Dejar el modelo abierto sin exponer UI.
17. **Estado en URL:** confirmar que no choca con la navegación del shell.

---

## 18. Pruebas

- **Unit (Vitest):** semáforo y clasificación de diferencia, verificado %, mediana de antigüedad, regla de cierre, `previewScope`, helpers de alcance (varias marcas, atajos), formateo de diferencias, motivo «Otros».
- **Integración (Testcontainers):** `applySession` nueva regla; `lastCountedAt` solo en verificados; participantes (ADMIN/MANAGER siempre, usuario asignado, no asignado de solo lectura); alta/baja lógica de responsables; ajuste individual y en lote crean movimiento vinculado y respetan permisos; `upsertCountLine` ligero; agregados por marca/proveedor/tipo; backfill de migración; compatibilidad con sesiones antiguas.
- **Componentes:** combobox multiselección (teclado, quitar con Backspace, persona externa), `CountRow` (Enter → siguiente pendiente, Esc revierte), `CoverageBar`, tooltips con foco.
- **E2E (Playwright):** crear conteo por 2 marcas + responsable externo → contar con teclado → revisar con recuento → ajustar con «Otros» → cerrar → ver informe y el desglose → verlo desde Historial; flujo de teléfono (viewport 390); matriz de roles; cancelar con motivo.
- Actualizar `e2e/inventory-count.test.ts` y los specs existentes. **No dejar tests en rojo ni comentados.**

---

## 19. Diferencias conocidas entre el mockup y la implementación real

- Iconos del mockup son glifos de texto: usar `@lucide/svelte`.
- El shell es un marco gris de referencia: no se implementa.
- Los datos son **inventados** (33 ítems, 6 marcas); el mockup no tiene backend, ni virtualización ni concurrencia.
- El tooltip del mockup es un único elemento flotante propio: en producción es `InfoTooltip`/`TriggerTooltip` ampliados.
- Combobox, barra de cobertura, toasts y stepper están hechos en HTML simple: en producción, kit + componentes de la sección 11.
- Los motivos de ajuste, el costo por ítem y «Último ciclo completo» son ilustrativos.
- El selector «Ver como» de la barra superior del mockup solo sirve para demostrar roles; no existe en producción.
- El mockup carga fuentes de Google; en producción se usan las del repo.
- Los conteos #1 y #2 del Historial son de ejemplo sin detalle.

---

## 20. Qué NO hacer

- No modificar el shell, el sidebar, productos, ventas ni la lógica de ajuste existente (solo reutilizarla).
- No ajustar stock automáticamente nunca; solo por acción explícita.
- No agregar colores, gradientes, bordes ≥ 2 px, sombras dramáticas, radios grandes en chips ni nada decorativo.
- No usar `title` para tooltips. No poner textos de ayuda largos fijos en pantalla.
- No hacer texto más pequeño que el piso de 4.2. No colorear ceros. No usar color como único indicador.
- No crear dependencias nuevas ni barrels. No duplicar clases (extrae componentes).
- No inventar reglas de negocio: lo no confirmado va a la sección 17.
- No usar `$effect`/`onMount` para cargar datos iniciales.
- No cruzar dimensiones en el alcance (varias marcas **o** varios proveedores **o** varios tipos, nunca mezclados).
- No dejar scroll dentro de scroll en 1280×720.
- No copiar valores del mockup que contradigan un token del repo: gana el repo.
- No avanzar de fase sin cerrar la anterior con `pnpm lint && pnpm test` en verde.

---

## 21. Definición de terminado

- Cómodo y legible en **1280×720**, bien resuelto en **1920×1080** y usable con el pulgar en **390×844**.
- Se puede responder, desde Cobertura, _cuándo se contó cada marca/proveedor/tipo y qué falta por verificar_, y armar un conteo por una o varias marcas/proveedores/tipos en pocos clics.
- Contar 674 ítems es una tarea de teclado (o de pulgar) sin cambiar de modo; el cierre produce un informe que muestra de un vistazo qué se movió por marca y proveedor; los conteos anteriores se pueden consultar.
- Responsables registrados (usuarios y personas externas) y visibles en el informe; editables mientras la sesión está abierta.
- Tokens, tipografía y componentes **del repo** en todo; tooltips en todo lo que lo necesite; accesibilidad y teclado verificados; estados vacío, cargando, error y bordes diseñados.
- Tests unit, integración y e2e en verde; Nanez aprueba con capturas.
