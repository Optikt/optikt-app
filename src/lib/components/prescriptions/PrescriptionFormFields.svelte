<script lang="ts">
	import { LensType } from '$lib/shared/enums/lensTypes';
	import { dateToISODateString } from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from './prescription-form';
	import DistancesSection from './fields/DistancesSection.svelte';
	import EyeCard from './fields/EyeCard.svelte';
	import HeaderSection from './fields/HeaderSection.svelte';
	import NotesSection from './fields/NotesSection.svelte';
	import TreatmentsSection from './fields/TreatmentsSection.svelte';

	interface Props {
		data: PrescriptionFormData;
		issues?: PrescriptionFieldIssues;
		namePrefix?: string;
		availableTo?: Date;
		showCurrentToggle?: boolean;
	}

	let {
		data = $bindable(),
		issues,
		namePrefix = 'prescription',
		availableTo = nowUTC(),
		showCurrentToggle = true
	}: Props = $props();

	const showAddition = $derived(
		data.recommendedLensType !== '' && data.recommendedLensType !== LensType.MONOFOCAL
	);

	const showAltura = $derived(showAddition);

	const maxPrescriptionDate = $derived(dateToISODateString(availableTo));
</script>

<div class="space-y-8">
	<HeaderSection {data} {issues} {namePrefix} {maxPrescriptionDate} {showCurrentToggle} />

	<section class="grid gap-8 xl:grid-cols-2">
		<EyeCard {data} side="od" {showAddition} {issues} {namePrefix} />
		<EyeCard {data} side="os" {showAddition} {issues} {namePrefix} />
	</section>

	<div class="grid gap-8 xl:grid-cols-2">
		<DistancesSection {data} {showAltura} {issues} {namePrefix} />
		<TreatmentsSection {data} {issues} {namePrefix} />
	</div>

	<NotesSection {data} {issues} {namePrefix} />
</div>
