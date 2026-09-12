---
plan name: dt1-t2-cash
plan description: Descomponer cash expenses T2
plan status: active
---

## Idea
Descomponer `src/routes/(app)/cash/expenses/+page.svelte` (912 líneas) con patrón orquestador: página ~210 + 4 secciones en `src/lib/components/cash/` (ExpenseToolbar, ExpenseSummary, ExpenseTable, ExpenseCreateModal) + `expenseForm.ts` puro (emptyExpenseForm, validateVoidReason, buildExpenseCsvRows) con spec espejo. Cero cambios UX. Remotes (list/create/void) y validaciones de submit intactos en la página.

## Implementation
- Crear rama chore/dt1-t2-cash-expenses y mapear secciones
- Extraer expenseForm.ts puro + spec espejo con casos
- Crear ExpenseToolbar (headers + filtros mobile/desktop) y cablear
- Crear ExpenseSummary + ExpenseTable y cablear
- Crear ExpenseCreateModal (deriveds internos) y podar página ~210
- Gates check/lint/test + size gate + QA cash + PR

## Required Specs
<!-- SPECS_START -->
- dt1-patterns
- dt1-split-protocol
- dt1-payment-strategy
- public-catalog-arch
- sale-subtotal-semantics
- cash-expenses-qa
<!-- SPECS_END -->