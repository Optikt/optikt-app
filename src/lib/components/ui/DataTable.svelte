<script lang="ts" generics="T extends { id: string }">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Spinner
	} from 'flowbite-svelte';
	import type { Snippet, Component } from 'svelte';
	import RowActions from './RowActions.svelte';

	type ActionColor = 'default' | 'blue' | 'red' | 'amber' | 'green';

	interface TableAction {
		id: string;
		icon?: Component<{ class?: string }>;
		label: string;
		color?: ActionColor;
		onclick?: () => void;
		hidden?: boolean;
		disabled?: boolean;
	}

	function parseActionString(
		actionString: string,
		handlers?: {
			onView?: () => void;
			onEdit?: () => void;
			onDelete?: () => void;
			onReactivate?: () => void;
			onToggle?: () => void;
			onDuplicate?: () => void;
			onExport?: () => void;
		}
	): TableAction[] {
		const actionNames = actionString.split(',').map((s) => s.trim().toLowerCase());
		const actions: TableAction[] = [];

		for (const name of actionNames) {
			switch (name) {
				case 'view':
					actions.push({
						id: 'view',
						label: 'Ver detalles',
						onclick: handlers?.onView
					});
					break;
				case 'edit':
					actions.push({
						id: 'edit',
						label: 'Editar',
						color: 'blue',
						onclick: handlers?.onEdit
					});
					break;
				case 'delete':
					actions.push({
						id: 'delete',
						label: 'Eliminar',
						color: 'red',
						onclick: handlers?.onDelete
					});
					break;
				case 'reactivate':
					actions.push({
						id: 'reactivate',
						label: 'Reactivar',
						color: 'green',
						onclick: handlers?.onReactivate
					});
					break;
				case 'toggle':
					actions.push({
						id: 'toggle',
						label: 'Activar',
						color: 'green',
						onclick: handlers?.onToggle
					});
					break;
				case 'duplicate':
					actions.push({
						id: 'duplicate',
						label: 'Duplicar',
						color: 'default',
						onclick: handlers?.onDuplicate
					});
					break;
				case 'export':
					actions.push({
						id: 'export',
						label: 'Exportar',
						color: 'default',
						onclick: handlers?.onExport
					});
					break;
			}
		}

		return actions;
	}

	interface Props {
		items: T[];
		loading?: boolean;
		emptyIcon?: Component<{ class?: string }>;
		emptyTitle?: string;
		emptyDescription?: string;
		header: Snippet;
		row: Snippet<[T]>;
		actions?: Snippet<[T]>;
		rowClass?: string;
		/** Callback to refresh data after an action completes */
		refetch?: () => void | Promise<void>;
		/** Shorthand for common actions: "view,edit,delete" or "view,edit" */
		defaultActions?: string;
		/** Called when a default action is triggered */
		onView?: (item: T) => void;
		onEdit?: (item: T) => void;
		onDelete?: (item: T) => void;
		onReactivate?: (item: T) => void;
		onToggle?: (item: T) => void;
		onDuplicate?: (item: T) => void;
		onExport?: (item: T) => void;
		/** Icon for view action */
		viewIcon?: Component<{ class?: string }>;
		/** Icon for edit action */
		editIcon?: Component<{ class?: string }>;
		/** Icon for delete action */
		deleteIcon?: Component<{ class?: string }>;
		/** Icon for reactivate action */
		reactivateIcon?: Component<{ class?: string }>;
		/** Icon for toggle action */
		toggleIcon?: Component<{ class?: string }>;
		/** Icon for duplicate action */
		duplicateIcon?: Component<{ class?: string }>;
		/** Icon for export action */
		exportIcon?: Component<{ class?: string }>;
	}

	let {
		items,
		loading = false,
		emptyIcon: EmptyIcon,
		emptyTitle = 'No se encontraron resultados',
		emptyDescription,
		header,
		row,
		actions: actionsSnippet,
		rowClass = 'hover:bg-slate-50',
		refetch,
		defaultActions,
		onView,
		onEdit,
		onDelete,
		onReactivate,
		onToggle,
		onDuplicate,
		onExport,
		viewIcon,
		editIcon,
		deleteIcon,
		reactivateIcon,
		toggleIcon,
		duplicateIcon,
		exportIcon
	}: Props = $props();

	/** Check if an item is soft-deleted (has a truthy deletedAt) */
	function isDeleted(item: T): boolean {
		return 'deletedAt' in item && !!(item as Record<string, unknown>).deletedAt;
	}

	// Whether both delete and reactivate are configured (mutually exclusive per row)
	function hasDeleteReactivateToggle(): boolean {
		return !!defaultActions?.includes('delete') && !!defaultActions?.includes('reactivate');
	}

	/** Build per-item actions on demand — avoids $derived signal timing issues during teardown */
	function buildItemActions(item: T): TableAction[] {
		if (!defaultActions) return [];

		const deleted = isDeleted(item);
		const toggleMode = hasDeleteReactivateToggle();

		return parseActionString(defaultActions, {
			onView: () => {},
			onEdit: () => {},
			onDelete: () => {},
			onReactivate: () => {},
			onToggle: () => {},
			onDuplicate: () => {},
			onExport: () => {}
		}).map((action) => {
			let icon: Component<{ class?: string }> | undefined;
			switch (action.id) {
				case 'view':
					icon = viewIcon;
					break;
				case 'edit':
					icon = editIcon;
					break;
				case 'delete':
					icon = deleteIcon;
					break;
				case 'reactivate':
					icon = reactivateIcon;
					break;
				case 'toggle':
					icon = toggleIcon;
					break;
				case 'duplicate':
					icon = duplicateIcon;
					break;
				case 'export':
					icon = exportIcon;
					break;
			}

			return {
				...action,
				icon,
				hidden: toggleMode
					? (action.id === 'delete' && deleted) || (action.id === 'reactivate' && !deleted)
					: false,
				onclick: () => {
					switch (action.id) {
						case 'view':
							onView?.(item);
							break;
						case 'edit':
							onEdit?.(item);
							break;
						case 'delete':
							onDelete?.(item);
							break;
						case 'reactivate':
							onReactivate?.(item);
							break;
						case 'toggle':
							onToggle?.(item);
							break;
						case 'duplicate':
							onDuplicate?.(item);
							break;
						case 'export':
							onExport?.(item);
							break;
					}
					refetch?.();
				}
			};
		});
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Spinner size="10" />
	</div>
{:else if items.length > 0}
	<Table hoverable>
		<TableHead class="bg-slate-50">
			{@render header()}
			{#if actionsSnippet || defaultActions}
				<TableHeadCell class="text-right font-semibold">Acciones</TableHeadCell>
			{/if}
		</TableHead>
		<TableBody>
			{#each items as item (item.id)}
				<TableBodyRow class={rowClass}>
					{@render row(item)}
					{#if actionsSnippet}
						<TableBodyCell class="text-right">
							<div class="flex justify-end gap-1">
								{@render actionsSnippet(item)}
							</div>
						</TableBodyCell>
					{:else if defaultActions}
						<TableBodyCell class="text-right">
							<RowActions {item} actions={buildItemActions(item)} />
						</TableBodyCell>
					{/if}
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
{:else}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center"
	>
		{#if EmptyIcon}
			<EmptyIcon class="mb-3 h-10 w-10 text-slate-400" />
		{/if}
		<p class="text-sm font-medium text-slate-600">{emptyTitle}</p>
		{#if emptyDescription}
			<p class="mt-1 text-xs text-slate-400">{emptyDescription}</p>
		{/if}
	</div>
{/if}
