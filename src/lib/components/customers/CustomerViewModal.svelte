<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { Phone, Mail, MapPin, Calendar, FileText, IdCard } from '@lucide/svelte';
	import type { Customer } from '$lib/server/db/schema';
	import { formatDate } from '$lib/utils';

	interface Props {
		open: boolean;
		customer: Customer;
	}

	let { open = $bindable(), customer }: Props = $props();

	function getFullName(c: Customer): string {
		return `${c.firstName} ${c.lastName}`;
	}

	function calculateAge(birthDate: Date | null): number | null {
		if (!birthDate) return null;
		const today = new Date();
		const birth = new Date(birthDate);
		let age = today.getFullYear() - birth.getFullYear();
		const monthDiff = today.getMonth() - birth.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
			age--;
		}
		return age;
	}

	const age = $derived(calculateAge(customer.birthDate));
</script>

<Modal bind:open size="md" title="Detalles del Cliente" outsideclose>
	<div class="space-y-6">
		<!-- Header with avatar -->
		<div class="flex items-center gap-4 border-b pb-4">
			<div
				class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl font-semibold text-primary-600"
			>
				{customer.firstName?.charAt(0) ?? 'C'}
			</div>
			<div>
				<h3 class="text-xl font-semibold text-slate-900">{getFullName(customer)}</h3>
				{#if customer.idNumber}
					<p class="font-mono text-sm text-slate-500">{customer.idNumber}</p>
				{/if}
			</div>
		</div>

		<!-- Contact info -->
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
					<Phone class="h-4 w-4 text-blue-600" />
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Teléfono</p>
					<p class="text-sm text-slate-900">{customer.primaryPhone}</p>
				</div>
			</div>

			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
					<Mail class="h-4 w-4 text-purple-600" />
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Email</p>
					<p class="text-sm text-slate-900">{customer.email ?? '—'}</p>
				</div>
			</div>

			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
					<IdCard class="h-4 w-4 text-amber-600" />
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Cédula</p>
					<p class="font-mono text-sm text-slate-900">{customer.idNumber ?? '—'}</p>
				</div>
			</div>

			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50">
					<Calendar class="h-4 w-4 text-green-600" />
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Fecha de Nacimiento</p>
					<p class="text-sm text-slate-900">
						{formatDate(customer.birthDate)}
						{#if age !== null}
							<span class="ml-1 font-medium text-green-600">({age} años)</span>
						{/if}
					</p>
				</div>
			</div>
		</div>

		<!-- Address -->
		{#if customer.address}
			<div class="flex items-start gap-3 border-t pt-4">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50">
					<MapPin class="h-4 w-4 text-rose-600" />
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Dirección</p>
					<p class="text-sm text-slate-900">{customer.address}</p>
				</div>
			</div>
		{/if}

		<!-- Notes -->
		{#if customer.notes}
			<div class="flex items-start gap-3 border-t pt-4">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
					<FileText class="h-4 w-4 text-slate-600" />
				</div>
				<div>
					<p class="text-xs font-medium text-slate-500">Notas</p>
					<p class="text-sm text-slate-900">{customer.notes}</p>
				</div>
			</div>
		{/if}
	</div>
</Modal>
