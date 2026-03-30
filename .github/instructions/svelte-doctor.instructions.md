---
applyTo: 'svelte-doctor.config.json,**/*.svelte,**/*.ts'
---

# svelte-doctor — Diagnostic Rules Reference

`svelte-doctor` analyzes Svelte/SvelteKit projects for correctness, performance, security, architecture, and bundle-size issues. Score: 0–100.

## Commands (Quick Reference)

| Command | Purpose |
|---------|---------|
| `pnpm svelte:doctor` | Full project scan |
| `svelte-doctor check --no-cache` | Cold scan (skip cache) |
| `svelte-doctor check --copy` | Export diagnostics for AI |
| `svelte-doctor apply --write` | Auto-fix safe patterns |
| `svelte-doctor apply --dry-run` | Preview safe fixes |
| `svelte-doctor baseline` | Snapshot current issues for suppression |
| `svelte-doctor check --baseline` | Only show new issues |
| `svelte-doctor watch` | Live score on file changes |
| `svelte-doctor trend` | Score history chart |
| `svelte-doctor deps` | Dependency health check |
| `svelte-doctor rules` | List all rules |
| `svelte-doctor explain <rule>` | Detailed rule explanation |

## Configuration

File: `svelte-doctor.config.json` in project root.

```json
{
  "ignore": {
    "rules": ["rule-name"],
    "files": ["path/to/exclude/"]
  },
  "lint": true,
  "deadCode": true,
  "cache": true
}
```

Or in `package.json` under `"svelte-doctor"` key.

## Rules (45 total)

### Correctness (7) — Svelte 4→5 migration issues (errors)

- `no-legacy-reactive` — `$:` → `$derived` / `$effect`
- `no-legacy-lifecycle` — `onMount`/`onDestroy` → `$effect`
- `no-export-let` — `export let` → `$props()`
- `no-event-dispatcher` — `createEventDispatcher` → callback props
- `no-legacy-slots` — `<slot>` → `{@render children()}`
- `no-let-directive` — `let:` → snippet props
- `no-on-directive` — `on:event` → `onevent` attributes (warning)

### Performance (8)

- `no-effect-for-derived` — `$effect` where `$derived` fits
- `each-missing-key` — `{#each}` without key
- `no-inline-object` — Inline objects/arrays in templates
- `no-transition-all` — `transition: all` is expensive
- `no-large-inline-list-transform` — `.filter().map().sort()` chains in markup
- `no-repeated-derived-allocation` — Allocations inside `$derived()`
- `no-blocking-sync-fs-in-hot-cli-path` — Sync fs in hot paths
- `prefer-lazy-deadcode-phase` — Full dead-code in fast feedback

### Architecture (4)

- `no-giant-component` — Component > 300 lines
- `no-deep-nesting` — > 3 levels template nesting
- `no-console` — `console.*` in components
- `no-multi-script` — Multiple `<script>` blocks

### Security (9) — All errors

- `no-unsafe-html` — `{@html}` XSS vector
- `no-secrets` — Hardcoded API keys/tokens
- `no-eval` — `eval()` usage
- `no-public-env-secrets` — Secrets from public `$env`
- `no-dangerous-redirect-param` — Redirect from untrusted query
- `cookie-missing-secure-flags` — `cookies.set()` missing flags
- `no-broad-cors` — Wildcard CORS
- `no-server-secret-leak` — Private env vars returned from server
- `no-unsafe-shell` — `exec`/`execSync`/`spawn` with shell

### SvelteKit (7)

- `no-client-fetch` — `fetch` in components → use load functions
- `load-missing-type` — Load fn without TypeScript annotation
- `no-goto-external` — `goto()` with external URLs
- `form-action-no-validation` — Form actions without validation
- `missing-error-page` — No `+error.svelte`
- `server-load-missing-error-guard` — Server load fetch without error handling
- `form-action-missing-auth-check` — Form actions without auth check

### Bundle Size (3)

- `no-barrel-import` — Barrel imports prevent tree-shaking
- `no-full-lodash` — Full lodash (~70kb)
- `no-moment` — moment.js (~300kb)

### Accessibility (3)

- `img-missing-alt` — `<img>` without `alt`
- `click-needs-keyboard` — Click on non-interactive without keyboard
- `anchor-no-content` — `<a>` without text/aria-label

### State & Reactivity (3)

- `no-unnecessary-state` — `$state` for never-mutated values
- `no-derived-side-effect` — Side effects in `$derived` (error)
- `prefer-runes` — `svelte/store` in runes-mode project

## Workflow

1. **Scan:** `pnpm svelte:doctor` — get current score
2. **Baseline (optional):** `svelte-doctor baseline` — freeze known issues
3. **Safe fixes:** `svelte-doctor apply --dry-run` then `--write`
4. **Manual fixes:** Address remaining diagnostics by priority (errors first, then warnings)
5. **Track:** `svelte-doctor trend` — monitor improvement over time
6. **CI gate:** `svelte-doctor check --min-score <N> --fail-on error`

## Interpreting Scores

| Score | Label | Action |
|-------|-------|--------|
| 90–100 | Excellent | Maintain |
| 70–89 | Good | Minor improvements |
| 50–69 | Needs Work | Prioritize fixes |
| 0–49 | Critical | Immediate action needed |
