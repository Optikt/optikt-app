---
applyTo: "**/*.svelte,**/*.css"
---

# Design Principles

Enforce precise, crafted design for enterprise/SaaS interfaces. Jony Ive-level precision with intentional personality.

## Design Direction (Think Before Coding)

Before writing UI code, consider:
- **What does this product do?** A finance tool ≠ a creative tool
- **Who uses it?** Power users want density; occasional users want guidance
- **What's the emotional job?** Trust? Efficiency? Delight?

### Personality Options
- **Precision & Density** — Tight spacing, monochrome, info-forward (Linear, Raycast)
- **Warmth & Approachability** — Generous spacing, soft shadows (Notion, Coda)
- **Sophistication & Trust** — Cool tones, layered depth (Stripe, Mercury)
- **Boldness & Clarity** — High contrast, dramatic negative space (Vercel)
- **Utility & Function** — Muted palette, functional density (GitHub)

Pick one direction and commit.

## Core Craft Principles

### The 4px Grid
- `4px` micro | `8px` tight | `12px` standard | `16px` comfortable | `24px` generous | `32px` major

### Symmetrical Padding
TLBR must match. `padding: 16px;` — not `padding: 24px 16px 12px 16px;`

### Border Radius
Stick to 4px grid. Sharp (4-8px) or Soft (8-12px). Don't mix systems.

### Depth Strategy (Pick ONE)
- **Borders-only (flat)** — Clean, technical. `border: 0.5px solid rgba(0,0,0,0.08)`
- **Subtle single shadows** — `0 1px 3px rgba(0,0,0,0.08)`
- **Layered shadows** — Rich, premium (Stripe-style)
- **Surface color shifts** — `#fff` on `#f8fafc` background

### Typography Hierarchy
- Headlines: 600 weight, -0.02em letter-spacing
- Body: 400-500 weight, standard tracking
- Labels: 500 weight, slight positive tracking for uppercase
- Scale: 11px → 12px → 13px → 14px (base) → 16px → 18px → 24px → 32px

### Monospace for Data
Numbers, IDs, codes, timestamps → monospace. Use `tabular-nums` for alignment.

### Icons
`@lucide/svelte` — icons clarify, not decorate. If removing one loses no meaning, remove it.

### Animation
- 150ms micro-interactions, 200-250ms larger transitions
- Easing: `cubic-bezier(0.25, 1, 0.5, 1)`
- No spring/bouncy effects

### Color for Meaning Only
Gray builds structure. Color only appears for: status, action, error, success. Decorative color is noise.

## Anti-Patterns (NEVER)
- Dramatic shadows (`box-shadow: 0 25px 50px...`)
- Large radius (16px+) on small elements
- Asymmetric padding without reason
- Thick borders (2px+) for decoration
- Spring/bouncy animations
- Gradients for decoration
- Multiple accent colors in one interface
