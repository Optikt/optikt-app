# Spec: flowbite-migration-detail

Scope: feature

# Flowbite → shadcn-svelte: Component Migration Detail

## Install

```bash
pnpm add bits-ui@^1 lucide-svelte@^1
pnpm add -D @shadcn-svelte/button @shadcn-svelte/input @shadcn-svelte/dialog @shadcn-svelte/select @shadcn-svelte/switch @shadcn-svelte/checkbox @shadcn-svelte/label @shadcn-svelte/popover @shadcn-svelte/command
```

## Fase 1a: FormInput.svelte

### Before (flowbite)

```svelte
<script>
	import { Input, Label, Helper } from 'flowbite-svelte';
</script>

{#if label}
	<Label for={id} color={hasError ? 'red' : undefined}>{label}</Label>
{/if}
<Input {id} {name} bind:value color={hasError ? 'red' : undefined} />
{#if displayError}
	<Helper color="red">{displayError}</Helper>
{/if}
```

### After (shadcn-svelte)

```svelte
<script>
	import { Label, Input } from 'bits-ui';
</script>

{#if label}
	<Label.Root for={id} class={hasError ? 'text-red-500' : ''}>{label}</Label.Root>
{/if}
<Input.Root {id} {name} bind:value class={hasError ? 'border-red-500' : ''} />
{#if displayError}
	<p class="mt-1 text-sm text-red-500">{displayError}</p>
{/if}
```

**Props mapping:**

- `Input color="red"` → `input class="border-red-500 focus:ring-red-500"`
- `Label color="red"` → `Label.Root class="text-red-500"`
- `Helper color="red"` → `<p class="text-sm text-red-500">`

## Fase 2a: ConfirmModal.svelte

### Before (flowbite)

```svelte
<Modal bind:open {size} {title} {permanent}>
	<div class="flex items-start gap-3">...</div>
	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={onCancel}>Cancelar</Button>
		<Button color="blue" onclick={onConfirm}>{label}</Button>
	</div>
</Modal>
```

### After (shadcn-svelte)

```svelte
<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[{size}]">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		<div class="flex items-start gap-3">...</div>
		<div class="mt-6 flex justify-end gap-2">
			<Button variant="outline" onclick={onCancel}>Cancelar</Button>
			<Button onclick={onConfirm}>{label}</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
```

**Props mapping:**

- `Modal size` → `Dialog.Content class="sm:max-w-[size]"`
- `Modal title` → `Dialog.Title`
- `Button color="light"` → `Button variant="outline"`
- `Button color="blue"` → `Button` (default)
- `Button color="red"` → `Button variant="destructive"`
- Spinner → `<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">...`

## Fase 3a: DataTable.svelte

Replace flowbite table wrappers with native `<table>` + Tailwind:

```svelte
<table class="w-full text-sm text-left">
	<thead>
		<tr class="border-b">
			{#each headers as header}
				<th class="px-4 py-3 font-medium text-gray-500">{header}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row}
			<tr class="border-b hover:bg-gray-50">
				{#each row as cell}
					<td class="px-4 py-3">{cell}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
```

## Fase 3b: TablePagination.svelte

Custom pagination with Tailwind buttons, no library needed. Already has logic for page calculation.

## Fase 1c: FormDatepicker.svelte

Use bits-ui `Popover` + `Calendar`:

```svelte
<Popover.Root>
	<Popover.Trigger asChild>
		<Button variant="outline">
			{selectedDate || 'Seleccionar fecha'}
		</Button>
	</Popover.Trigger>
	<Popover.Content>
		<Calendar bind:selectedDate />
	</Popover.Content>
</Popover.Root>
```

## Fase 5a: layout.css cleanup

Remove:

- `@plugin 'flowbite/plugin';`
- `@source '../../node_modules/flowbite-svelte/dist';`
- `@source '../../node_modules/flowbite-svelte-icons/dist';`
- CSS overrides for flowbite focus colors (lines 163-197)

## Colors mapping

| flowbite color        | shadcn-svelte / Tailwind       |
| --------------------- | ------------------------------ |
| `color="blue"`        | Default button / `bg-blue-600` |
| `color="light"`       | `variant="outline"`            |
| `color="red"`         | `variant="destructive"`        |
| `color="alternative"` | `variant="secondary"`          |

## Spinner SVG (custom, inline)

```svelte
<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
	<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
	<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>
```
