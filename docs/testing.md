# Testing Strategy

## Test Types

| Type            | Tool                | Location                  | Pattern            |
| --------------- | ------------------- | ------------------------- | ------------------ |
| Unit tests      | Vitest              | Co-located with source    | `*.spec.ts`        |
| Component tests | Vitest + Playwright | Co-located with component | `*.svelte.spec.ts` |
| E2E tests       | Playwright          | `e2e/` folder             | `*.test.ts`        |

## Priority Levels

### 🔴 High Priority

Core utilities and shared logic that everything depends on:

- **Utility functions** - Pure functions with clear input/output
- **Validation schemas** - Shared schemas used across modules
- **Error handling** - Functions that format/transform errors

### 🟡 Medium Priority

Server-side logic and critical UI components:

- **Auth guards** - Route protection, session validation
- **Module-specific schemas** - Entity validation (customers, suppliers, etc.)
- **Input components with logic** - Components that transform/format data

### 🟢 Low Priority

Integration and visual tests:

- **Database queries** - Require mocks or test DB setup
- **E2E flows** - Full user journeys (login, CRUD operations)
- **Modal/form components** - Complex UI with many interactions

## Commands

```bash
pnpm test:unit      # Run all unit tests
pnpm vitest         # Watch mode
pnpm test:e2e       # Run E2E tests
pnpm test           # Run all tests
```
