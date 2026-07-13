# Spec: flowbite-migration-arch

Scope: repo

# Flowbite → shadcn-svelte Migration Architecture

## Purpose

Replace all `flowbite` and `flowbite-svelte` components with `shadcn-svelte` (bits-ui) or custom Tailwind equivalents. 57 files to migrate, no UI changes.

## Component Mapping

| Flowbite             | Reemplazo                          | Librería |
| -------------------- | ---------------------------------- | -------- |
| `Button`             | `Button`                           | bits-ui  |
| `Modal`              | `Dialog`                           | bits-ui  |
| `Spinner`            | SVG inline (12 líneas)             | Custom   |
| `Input`              | `Input`                            | bits-ui  |
| `Label`              | `Label`                            | bits-ui  |
| `Select`             | `Select`                           | bits-ui  |
| `Checkbox`           | `Checkbox`                         | bits-ui  |
| `Toggle`             | `Switch`                           | bits-ui  |
| `Textarea`           | `Textarea`                         | bits-ui  |
| `Datepicker`         | `Calendar` + `Popover`             | bits-ui  |
| `Badge`              | `<span>` con Tailwind              | Custom   |
| `Helper`             | `<p class="text-red-500 text-sm">` | Custom   |
| `Table*`             | `<table>` nativo Tailwind          | Custom   |
| `PaginationNav`      | Custom con Tailwind                | Custom   |
| `Popover`            | `Popover`                          | bits-ui  |
| `TableHeadCell`      | `<th>`                             | Custom   |
| `TableBodyCell`      | `<td>`                             | Custom   |
| type `ButtonProps`   | bits-ui `Button` props             | Custom   |
| type `InputProps`    | bits-ui `Input` props              | Custom   |
| type `TextareaProps` | bits-ui `Textarea` props           | Custom   |

## Architecture

The project already has a wrapper layer under `src/lib/components/ui/`:

| Wrapper           | Flowbite envuelto                | Beneficiarios |
| ----------------- | -------------------------------- | ------------- |
| `ConfirmModal`    | Modal + Button + Spinner         | ~15 modals    |
| `FormInput`       | Input + Label + Helper           | ~12 forms     |
| `FormTextarea`    | Textarea + Label + Helper        | 2 forms       |
| `FormActions`     | Button + Spinner                 | ~10 forms     |
| `DataTable`       | Table + Head + Body + Row + Cell | ~6 tables     |
| `TablePagination` | PaginationNav                    | ~8 tables     |
| `FormDatepicker`  | Datepicker + Label + Helper      | 3 forms       |
| `BaseSelect`      | Label                            | ~5 forms      |
| `SearchInput`     | Input                            | ~5 inputs     |

Strategy: **migrate wrappers first** → all consumers benefit without being touched.

## Files

- layout.css: remove `@plugin 'flowbite/plugin'`, `@source` directives, CSS overrides (~30 lines)
- package.json: remove `flowbite` + `flowbite-svelte`
- 57 .svelte files: component replacements (all under `src/`)
