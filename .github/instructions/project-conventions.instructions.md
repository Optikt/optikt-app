---
applyTo: '**'
---

# Project Conventions

## Tools & Runtime

- **Package manager:** pnpm (always: `pnpm install`, `pnpm add`, `pnpm dlx`, `pnpm dev`, `pnpm build`)
- **Language:** TypeScript is mandatory
- **Styles:** Tailwind CSS only — no other CSS solutions
- **Icons:** `@lucide/svelte` — explicit imports, never barrels
- **Syntax:** Prefer ESM and modern browser patterns

## Code Organization

- Components should be small with a single responsibility
- Prefer composition over complex configuration
- Avoid premature abstractions
- Shared code lives in clear folders: `components`, `layouts`, `lib`, `utils`
- Use `shared` folders for code used on both server and client

## TypeScript Rules

- Avoid `any` and `unknown`
- Prefer type inference whenever possible
- If types aren't clear, stop and clarify before continuing

## UI & Styles

- Tailwind is the **only** styling solution
- Don't duplicate classes — extract a component instead
- Prioritize readability over micro-optimizations
- Accessibility is not optional: semantic HTML, ARIA roles when needed, managed focus
- Define prop types inside each component for readability when destructuring `$props`

## Testing & Quality

- CI workflows live in `.github/workflows`
- Run tests: `pnpm test`
- Run specific Vitest test: `pnpm vitest run -t "<test name>"`
- After moving files or changing imports: `pnpm lint`
- No code accepted with type errors, lint errors, or failing tests
- Add or update tests when changing behavior, even if not explicitly asked

## Performance

- Never guess about performance, bundle size, or load times — measure
- If something seems slow, add instrumentation before optimizing
- Validate changes on a small scale before applying project-wide

## Commits & PRs

- PR title: `[optikt-app] Clear, concise description`
- Keep PRs small and focused
- Before committing: `pnpm lint && pnpm test`
- Explain what changed, why, and how it was verified

## Agent Behavior

- If a request is unclear, ask concrete questions before executing
- Simple, well-defined tasks: execute directly
- Complex changes (refactors, new features, architecture decisions): confirm understanding first
- Never assume implicit requirements — ask when info is missing
