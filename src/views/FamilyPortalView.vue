<script setup lang="ts">
import { computed, onMounted } from 'vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import ActivitySection from '@/components/resident/ActivitySection.vue'
import BillingSummaryCard from '@/components/resident/BillingSummaryCard.vue'
import HealthSummaryCard from '@/components/resident/HealthSummaryCard.vue'
import ResidentDetailHeader from '@/components/resident/ResidentDetailHeader.vue'
import UnitSection from '@/components/resident/UnitSection.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import type { SelectOption } from '@/components/ui/BaseSelect.types'
import { useResidentData } from '@/composables/useResidentData'
import { useResidentList } from '@/composables/useResidentList'
import { useAuthStore } from '@/stores/authStore'
import { useResidentStore } from '@/stores/residentStore'
import type { ResidentId } from '@/types'

const auth = useAuthStore()
const residentStore = useResidentStore()
const { items, loading: listLoading } = useResidentList()

/**
 * Keluarga terkunci pada satu penghuni (dari sesi); staf boleh memilih siapa pun
 * untuk melihat pratinjau tampilan keluarga.
 */
const isLockedToOwnResident = computed(() => auth.role === 'family')

const selectedId = computed<ResidentId | null>({
  get: () => (isLockedToOwnResident.value ? auth.scopedResidentId : residentStore.selectedResidentId),
  set: (value) => residentStore.selectResident(value),
})

const options = computed<SelectOption<ResidentId>[]>(() =>
  items.value.map(({ resident, unit }) => ({
    value: resident.id,
    label: unit ? `${resident.name} — ${unit.unitCode}` : resident.name,
  })),
)

// Composable yang sama dengan view lain; flag isFamilyView memangkas data medis
// detail di service layer, bukan sekadar disembunyikan di template.
const { resident, unit, billingSummary, healthSummary, activities, loading } = useResidentData(
  selectedId,
  { isFamilyView: true },
)

onMounted(() => {
  // Staf yang baru membuka halaman ini langsung melihat contoh, bukan layar kosong.
  if (!isLockedToOwnResident.value && !residentStore.selectedResidentId && auth.role === 'admin') {
    residentStore.selectResident('R001')
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Family Portal"
      description="Ringkasan kondisi penghuni untuk keluarga dan kerabat."
    />

    <!-- <BaseCallout tone="note" title="Data medis disaring di sisi server">
      Portal ini hanya menerima ringkasan kondisi. Tekanan darah, detak jantung, dan catatan
      caregiver tidak pernah dikirim ke halaman ini.
    </BaseCallout> -->

    <BaseSelect
      v-if="!isLockedToOwnResident"
      v-model="selectedId"
      label="Pilih penghuni (pratinjau staf)"
      placeholder="— Pilih penghuni —"
      :options="options"
    />

    <LoadingState v-if="listLoading || loading" :rows="4" />

    <EmptyState
      v-else-if="!resident"
      title="Belum ada penghuni dipilih"
      description="Pilih salah satu penghuni untuk melihat ringkasan kondisinya."
    />

    <template v-else>
      <ResidentDetailHeader :resident="resident" :unit="unit" is-family-view />

      <div class="flex flex-col gap-4">
        <UnitSection :unit="unit" />

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BillingSummaryCard :summary="billingSummary" />
          <HealthSummaryCard :summary="healthSummary" />
        </div>

        <ActivitySection :activities="activities" :resident-id="resident.id" />
        <!-- EXTENSION POINT: tambah widget family portal baru di sini (pesan, jadwal kunjungan). -->
      </div>
    </template>
  </div>
</template>
