<script lang="ts">
	interface Props {
		supplierId: string;
		materialId: string;
		technologyId: string;
		supplierOptions: { value: string; label: string }[];
		materialOptions: { value: string; label: string }[];
		technologyOptions: { value: string; label: string }[];
		supplierHelperText: string;
		materialHelperText: string;
		differentiatorHelperText: string;
		onSupplierChange: (id: string) => void;
		onCreateSupplier: (name: string) => { value: string; label: string };
		onCreateMaterial: (name: string) => { value: string; label: string };
		onCreateTechnology: (name: string) => { value: string; label: string };
	}

	let {
		supplierId = $bindable(),
		materialId = $bindable(),
		technologyId = $bindable(),
		supplierOptions,
		materialOptions,
		technologyOptions,
		supplierHelperText,
		materialHelperText,
		differentiatorHelperText,
		onSupplierChange,
		onCreateSupplier,
		onCreateMaterial,
		onCreateTechnology
	}: Props = $props();

	// Simple creatable select emulation with prompt
	function handleCreate(type: 'supplier' | 'material' | 'technology') {
		const name = prompt(`Nombre del nuevo ${type}:`);
		if (!name?.trim()) return;
		let option: { value: string; label: string };
		if (type === 'supplier') {
			option = onCreateSupplier(name.trim());
			supplierId = option.value;
			onSupplierChange(option.value);
		} else if (type === 'material') {
			option = onCreateMaterial(name.trim());
			materialId = option.value;
		} else {
			option = onCreateTechnology(name.trim());
			technologyId = option.value;
		}
	}
</script>

<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
	<h3 class="mb-4 font-heading text-lg font-semibold text-on-surface">Selección</h3>
	<div class="space-y-4">
		<div>
			<label class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Proveedor *</label>
			<div class="flex gap-2">
				<select bind:value={supplierId} onchange={(e) => onSupplierChange((e.target as HTMLSelectElement).value)} class="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
					<option value="">Seleccione proveedor</option>
					{#each supplierOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<button type="button" onclick={() => handleCreate('supplier')} class="shrink-0 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white hover:bg-brand-navy-dark">+</button>
			</div>
			<p class="mt-1 text-xs text-slate-500">{supplierHelperText}</p>
		</div>
		<div>
			<label class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Material *</label>
			<div class="flex gap-2">
				<select bind:value={materialId} class="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
					<option value="">Seleccione material</option>
					{#each materialOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<button type="button" onclick={() => handleCreate('material')} class="shrink-0 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white hover:bg-brand-navy-dark">+</button>
			</div>
			<p class="mt-1 text-xs text-slate-500">{materialHelperText}</p>
		</div>
		<div>
			<label class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Tecnología</label>
			<div class="flex gap-2">
				<select bind:value={technologyId} class="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
					<option value="">Seleccione tecnología</option>
					{#each technologyOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<button type="button" onclick={() => handleCreate('technology')} class="shrink-0 rounded-lg bg-brand-navy px-3 py-2 text-xs font-bold text-white hover:bg-brand-navy-dark">+</button>
			</div>
			<p class="mt-1 text-xs text-slate-500">{differentiatorHelperText}</p>
		</div>
	</div>
</section>
