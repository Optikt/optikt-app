# TODO PRE-RELEASE — Optikt App

Tareas obligatorias antes de usar la app en la óptica.

---

## 1. Simplificar roles (eliminar SUPERADMIN)

**Estado:** ✅ completado

Actualmente hay 5 roles (SUPERADMIN, ADMIN, MANAGER, SELLER, VIEWER) pero SUPERADMIN, ADMIN y MANAGER hacen prácticamente lo mismo. Se simplifica a **4 roles**:

| Rol         | Descripción                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| **ADMIN**   | Acceso total. Único que gestiona usuarios. Mínimo 1 debe existir en el sistema.                                           |
| **MANAGER** | Igual que ADMIN excepto: no puede crear/editar/eliminar usuarios, no puede eliminar admins ni managers.                   |
| **SELLER**  | Operacional: vender, cobrar, crear clientes y prescripciones, crear presupuestos. No puede tocar catálogos ni inventario. |
| **VIEWER**  | Solo lectura. Puede crear y editar presupuestos, pero no convertir a venta ni realizar acciones destructivas.             |

### Cambios técnicos

- [x] Eliminar `SUPERADMIN` del enum `UserRole` en `src/lib/shared/enums/roles.ts`
- [x] Actualizar `guards.ts`: `requireAdmin()` → `ADMIN + MANAGER`, nuevo `requireUserAdmin()` → solo `ADMIN`
- [x] Actualizar `users.remote.ts`: usar `requireUserAdmin()` en vez de `requireAdmin()`
- [x] Migración DB: convertir usuarios con rol `SUPERADMIN` → `ADMIN`
- [x] Actualizar `isAdminRole()`, `isSuperAdminRole()` → eliminar/simplificar
- [x] Actualizar UI que referencia SUPERADMIN (badges, selects de roles, etc.)
- [ ] Regla: no se puede eliminar el último ADMIN del sistema
- [ ] Regla: MANAGER no puede eliminar ADMIN ni otros MANAGER

---

## 2. Auth guards en remote functions

**Estado:** ✅ completado (95 funciones protegidas en 16 archivos)

17 de 20 archivos remote no tienen guards. El layout solo protege la carga de páginas, no las invocaciones directas de remote functions.

### Regla general

- **Todas las lecturas (query):** `requireAuth()` — cualquier usuario logueado puede leer
- **Escrituras operacionales:** `requireRole(ADMIN, MANAGER, SELLER)` — excluye VIEWER
- **Escrituras de catálogo/gestión:** `requireAdmin()` → ADMIN + MANAGER
- **Gestión de usuarios y config:** `requireUserAdmin()` → solo ADMIN

### Matriz de permisos por sección

#### Ventas

| Acción                 | ADMIN | MANAGER | SELLER | VIEWER |
| ---------------------- | :---: | :-----: | :----: | :----: |
| Ver ventas / detalle   |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear venta            |  ✅   |   ✅    |   ✅   |   ❌   |
| Agregar pago           |  ✅   |   ✅    |   ✅   |   ❌   |
| Anular pago            |  ✅   |   ✅    |   ❌   |   ❌   |
| Cancelar venta         |  ✅   |   ✅    |   ❌   |   ❌   |
| Editar costos internos |  ✅   |   ✅    |   ❌   |   ❌   |

#### Presupuestos

| Acción                     | ADMIN | MANAGER | SELLER | VIEWER |
| -------------------------- | :---: | :-----: | :----: | :----: |
| Ver presupuestos           |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear presupuesto          |  ✅   |   ✅    |   ✅   |   ✅   |
| Editar presupuesto (draft) |  ✅   |   ✅    |   ✅   |   ✅   |
| Asignar cliente            |  ✅   |   ✅    |   ✅   |   ✅   |
| Cancelar presupuesto       |  ✅   |   ✅    |   ✅   |   ❌   |
| Convertir a venta          |  ✅   |   ✅    |   ✅   |   ❌   |

#### Clientes

| Acción            | ADMIN | MANAGER | SELLER | VIEWER |
| ----------------- | :---: | :-----: | :----: | :----: |
| Ver clientes      |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear cliente     |  ✅   |   ✅    |   ✅   |   ❌   |
| Editar cliente    |  ✅   |   ✅    |   ✅   |   ❌   |
| Eliminar cliente  |  ✅   |   ✅    |   ❌   |   ❌   |
| Reactivar cliente |  ✅   |   ✅    |   ❌   |   ❌   |

#### Prescripciones

| Acción                | ADMIN | MANAGER | SELLER | VIEWER |
| --------------------- | :---: | :-----: | :----: | :----: |
| Ver prescripciones    |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear prescripción    |  ✅   |   ✅    |   ✅   |   ❌   |
| Editar prescripción   |  ✅   |   ✅    |   ✅   |   ❌   |
| Marcar como actual    |  ✅   |   ✅    |   ✅   |   ❌   |
| Eliminar prescripción |  ✅   |   ✅    |   ❌   |   ❌   |

#### Productos

| Acción                  | ADMIN | MANAGER | SELLER | VIEWER |
| ----------------------- | :---: | :-----: | :----: | :----: |
| Ver productos           |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear producto          |  ✅   |   ✅    |   ❌   |   ❌   |
| Editar producto         |  ✅   |   ✅    |   ❌   |   ❌   |
| Eliminar / reactivar    |  ✅   |   ✅    |   ❌   |   ❌   |
| Toggle activo           |  ✅   |   ✅    |   ❌   |   ❌   |
| Actualizar precio venta |  ✅   |   ✅    |   ❌   |   ❌   |

#### Lentes (Catálogo)

| Acción                          | ADMIN | MANAGER | SELLER | VIEWER |
| ------------------------------- | :---: | :-----: | :----: | :----: |
| Ver catálogo                    |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear / editar / eliminar lente |  ✅   |   ✅    |   ❌   |   ❌   |
| CRUD materiales de lente        |  ✅   |   ✅    |   ❌   |   ❌   |

#### Compras (Órdenes de compra)

| Acción                        | ADMIN | MANAGER | SELLER | VIEWER |
| ----------------------------- | :---: | :-----: | :----: | :----: |
| Ver órdenes                   |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear orden                   |  ✅   |   ✅    |   ❌   |   ❌   |
| Editar orden (draft)          |  ✅   |   ✅    |   ❌   |   ❌   |
| Confirmar orden               |  ✅   |   ✅    |   ❌   |   ❌   |
| Cancelar orden                |  ✅   |   ✅    |   ❌   |   ❌   |
| Aplicar sugerencias de precio |  ✅   |   ✅    |   ❌   |   ❌   |

#### Inventario

| Acción                 | ADMIN | MANAGER | SELLER | VIEWER |
| ---------------------- | :---: | :-----: | :----: | :----: |
| Ver movimientos        |  ✅   |   ✅    |   ✅   |   ✅   |
| Ajuste manual          |  ✅   |   ❌    |   ❌   |   ❌   |
| Revertir lote completo |  ✅   |   ❌    |   ❌   |   ❌   |

#### Catálogos (Marcas, Proveedores, Materiales)

| Acción                            | ADMIN | MANAGER | SELLER | VIEWER |
| --------------------------------- | :---: | :-----: | :----: | :----: |
| Ver                               |  ✅   |   ✅    |   ✅   |   ✅   |
| Crear / editar                    |  ✅   |   ✅    |   ❌   |   ❌   |
| Eliminar / reactivar              |  ✅   |   ✅    |   ❌   |   ❌   |
| Quick-create (inline desde forms) |  ✅   |   ✅    |   ❌   |   ❌   |
| CRUD treatments (proveedores)     |  ✅   |   ✅    |   ❌   |   ❌   |

#### Usuarios

| Acción                            | ADMIN | MANAGER | SELLER | VIEWER |
| --------------------------------- | :---: | :-----: | :----: | :----: |
| Ver usuarios                      |  ✅   |   ❌    |   ❌   |   ❌   |
| Crear / editar / eliminar usuario |  ✅   |   ❌    |   ❌   |   ❌   |
| Toggle activo                     |  ✅   |   ❌    |   ❌   |   ❌   |
| Reactivar usuario                 |  ✅   |   ❌    |   ❌   |   ❌   |

#### Configuración (Settings)

| Acción               | ADMIN | MANAGER | SELLER | VIEWER |
| -------------------- | :---: | :-----: | :----: | :----: |
| Ver configuración    |  ✅   |   ✅    |   ❌   |   ❌   |
| Editar configuración |  ✅   |   ❌    |   ❌   |   ❌   |

#### Tasas de cambio

| Acción                | ADMIN | MANAGER | SELLER | VIEWER |
| --------------------- | :---: | :-----: | :----: | :----: |
| Ver tasas             |  ✅   |   ✅    |   ✅   |   ✅   |
| Guardar / editar tasa |  ✅   |   ✅    |   ❌   |   ❌   |
| Eliminar tasa         |  ✅   |   ✅    |   ❌   |   ❌   |

#### Reportes, Búsqueda, Historial, Perfil

| Acción                    | ADMIN | MANAGER | SELLER | VIEWER |
| ------------------------- | :---: | :-----: | :----: | :----: |
| Ver reportes              |  ✅   |   ✅    |   ✅   |   ✅   |
| Búsqueda global           |  ✅   |   ✅    |   ✅   |   ✅   |
| Ver historial de entidad  |  ✅   |   ✅    |   ✅   |   ✅   |
| Editar perfil propio      |  ✅   |   ✅    |   ✅   |   ✅   |
| Cambiar contraseña propia |  ✅   |   ✅    |   ✅   |   ✅   |
| Login / logout            |  ✅   |   ✅    |   ✅   |   ✅   |

### Archivos remote a proteger (15)

| Archivo                    | Reads | Writes | Guard para writes                                              |
| -------------------------- | ----- | ------ | -------------------------------------------------------------- |
| `sales.remote.ts`          | 4     | 5      | crear/pagar: excl. VIEWER · anular/cancelar/costos: ADMIN+MGR  |
| `quotes.remote.ts`         | 3     | 5      | crear/editar/asignar: todos · cancelar/convertir: excl. VIEWER |
| `customers.remote.ts`      | 1     | 4      | crear/editar: excl. VIEWER · eliminar/reactivar: ADMIN+MGR     |
| `prescriptions.remote.ts`  | 3     | 5      | crear/editar/actual: excl. VIEWER · eliminar: ADMIN+MGR        |
| `products.remote.ts`       | 2     | 5      | todos: ADMIN+MGR                                               |
| `brands.remote.ts`         | 2     | 4      | todos: ADMIN+MGR                                               |
| `suppliers.remote.ts`      | 2     | 7      | todos: ADMIN+MGR                                               |
| `materials.remote.ts`      | 2     | 4      | todos: ADMIN+MGR                                               |
| `lenses.remote.ts`         | 2     | 5      | todos: ADMIN+MGR                                               |
| `purchaseOrders.remote.ts` | 4     | 5      | todos: ADMIN+MGR                                               |
| `inventory.remote.ts`      | 1     | 2      | ya protegido — actualizar a solo ADMIN                         |
| `exchangeRates.remote.ts`  | 3     | 3      | guardar/eliminar: ADMIN+MGR                                    |
| `settings.remote.ts`       | 1     | 1      | editar: solo ADMIN                                             |
| `search.remote.ts`         | 1     | 0      | solo requireAuth                                               |
| `history.remote.ts`        | 1     | 0      | solo requireAuth                                               |
| `reports.remote.ts`        | 3     | 0      | solo requireAuth                                               |

**Excluidos:** `auth.remote.ts` (pre-auth), `profile.remote.ts` (ya protegido).

---

## 3. Quitar "Tasa BCV" del detalle de venta

**Estado:** ✅ completado

El card de historial de pagos muestra "TASA BCV 0.00 Bs/$" en la esquina superior. No tiene sentido porque la tasa BCV ya se guarda **por pago individual** (campo `bcvRate` en `sale_payments`). El valor global es confuso y muestra 0.00.

### Cambios

- [x] Eliminar el div "Tasa BCV / X.XX Bs/$" de `src/routes/(app)/sales/[id]/+page.svelte`
- [x] ~~Eliminar `getLatestRates()` y `bcvRate` de `+page.server.ts`~~ — se mantiene porque `PaymentForm` lo usa como tasa por defecto
- [x] Eliminar el comentario TODO/FIXME asociado

---

## 4. Plan IVA configurable (post-release, Fase 9)

**Estado:** pendiente — `/config` ya es funcional ✅

Actualmente el IVA 16% está hardcoded como `.default(16)` en 8 archivos (schemas de Zod y columnas de Drizzle). Funciona porque cada venta/compra ya guarda su tasa como snapshot.

### Plan

- [x] Arreglar bug "Settings is always null" en `/config` — `getSettings()` ahora auto-crea la fila singleton
- [ ] Agregar campo `defaultTaxRate` a la tabla `business_settings`
- [ ] Extraer constante `DEFAULT_TAX_RATE = 16` como fallback temporal
- [ ] Los formularios de nueva venta/compra/producto leen el default de Settings
- [ ] Los snapshots existentes no se tocan — ya tienen su tasa guardada
- [ ] Si el IVA cambia, solo se actualiza en Settings y afecta nuevas operaciones

---

## Orden de ejecución

1. **Crear `TODO_PRERELEASE.md`** ← este archivo ✅
2. **Quitar "Tasa BCV"** del detalle de venta ✅
3. **Simplificar roles** (eliminar SUPERADMIN) ✅
4. **Auth guards** en 16 archivos remote (95 funciones) ✅
5. **Verificación:** `pnpm check && pnpm vitest run` — 0 errores ✅
6. **IVA configurable** — diferido a Fase 9 (migración de `/config`)
