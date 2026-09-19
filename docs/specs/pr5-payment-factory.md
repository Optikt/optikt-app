# Spec: pr5-payment-factory

Scope: feature

# Spec: pr5-payment-factory

Scope: feature

# Feature: State factory de dinero + component testing híbrido

Reusable para cualquier componente Svelte 5 que mezcle markup con estado reactivo de dinero.

## Problema

`PaymentForm.svelte` (518) quedó como excepción del size gate porque su lógica vive en ~15 `$state` y ~40 `$derived` encadenados, sin lugar donde testearla sin montar el componente. El harness DT9 ya existe (integration + Capa 3 + E2E), así que se puede extraer.

## Patrón: state factory (`.svelte.ts`)

```
componente.svelte      props + model + markup (verbatim, mismo DOM/render)
componentModel.svelte.ts   createComponentModel(getProps, sel):
                           $state/$derived/$effect + handlers + submit
substate.svelte.ts     sub-máquina de modales/beneficios con callbacks inyectados
selection.svelte.ts    (ya existente) campos de formulario + reset/select/input
```

Reglas:

- `createComponentModel` es una **factory function** llamada en init del componente; devuelve un objeto con deriveds, handlers y flags (`canSubmit`, `submitLabel`). Los runes viven en `.svelte.ts`.
- Los `$effect` de sincronización (resetKey, composer request, preselect) se absorben en la clase/estado que posee el campo, no en el componente.
- El componente conserva `$props()` y los `bind:` (p. ej. `bind:isCasheaSale` con setter espejo). Cero cambio de UX/DOM: verbatim move.
- No es inlining arbitrario: el corte es por responsabilidad (selección / derivados / sub-máquina de modales / orquestación).

## Component testing (nuevo en el repo)

- Runner: proyecto vitest `client` (`src/**/*.svelte.spec.ts`) con `@vitest/browser-playwright` (chromium real) + `vitest-browser-svelte`.
- Probar desde la perspectiva del usuario: renderizar, buscar por texto/role, input/click, sin tocar estado interno.
- Alcance: el modelo (defaults por rail, conversiones, referencia requerida, gating de submit, sobrepago, liquidación, resetKey) y piezas presentacionales (label/disabled del submit, warning de sobrepago).
- Helpers puros (p. ej. `paymentFormDerived.ts`) van a spec en el proyecto `server`, data-driven.

## Coverage / Sonar

- Testear **no alcanza** para Sonar: el archivo debe estar en `coverage.include` o cuenta 0% en new code.
- Agregar include **acotado** a los archivos nuevos + helpers puros, con threshold propio (`lines >=80`); no tocar los thresholds globales ni excluir componentes.
- `**/*.svelte` sigue fuera de coverage (markup), pero `.svelte.ts` y `.ts` de la capa sí se cubren.

## E2E de dinero

- Datos prerequisito por SQL (`e2e/fixtures.ts` + `runId`), la acción bajo test por UI.
- Selectores por role/name; sin `waitForTimeout`. `workers: 1`; datos únicos por test.
- Cada flujo asserta el efecto de negocio (toast, estado, saldo, caja), no el DOM incidental.

## Aceptación

- Componente bajo el umbral de warn (≤300) y sin excepción en `check-file-size.sh`.
- Modelo y presentacionales con spec de componente; helpers puros con spec server.
- Flujos E2E verdes; Sonar Quality Gate passed sin exclusiones nuevas de componentes.
