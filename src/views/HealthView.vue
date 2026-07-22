<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { getEhrRows } from '@/services/reportsService'
import { ROUTE } from '@/router/routeNames'
import { formatDate } from '@/utils/formatDate'
import type { Ehr, WithResident } from '@/types'

const router = useRouter()

const rows = ref<WithResident<Ehr>[]>([])
const loading = ref(true)

const columns: TableColumn<WithResident<Ehr>>[] = [
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.date) },
  { key: 'residentName', label: 'Penghuni', value: (row) => row.residentName },
  { key: 'bloodPressure', label: 'Tekanan Darah', value: (row) => `${row.bloodPressure} mmHg` },
  { key: 'heartRate', label: 'Detak Jantung', value: (row) => `${row.heartRate} bpm` },
  { key: 'notes', label: 'Catatan', value: (row) => row.notes },
  { key: 'caregiver', label: 'Caregiver', align: 'right', value: (row) => row.caregiver },
]

onMounted(async () => {
  rows.value = await getEhrRows()
  loading.value = false
})

function openResident(residentId: string): void {
  void router.push({ name: ROUTE.residentDetail, params: { id: residentId } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Kesehatan"
      description="Catatan pemeriksaan seluruh penghuni. Hanya dapat diakses staf care."
    />

    <LoadingState v-if="loading" :rows="4" />

    <BaseCard v-else title="Riwayat Pemeriksaan" flush>
      <BaseTable :columns="columns" :rows="rows" :row-key="(row) => row.id">
        <template #cell-residentName="{ row }">
          <button
            type="button"
            class="font-medium text-ink-primary underline decoration-brand decoration-2 underline-offset-4 transition-colors hover:decoration-ink-primary"
            @click="openResident(row.residentId)"
          >
            {{ row.residentName }}
          </button>
        </template>

        <template #empty>
          <div class="px-4">
            <EmptyState
              title="Belum ada catatan"
              description="Tambahkan catatan lewat halaman detail penghuni."
            />
          </div>
        </template>
      </BaseTable>
    </BaseCard>
  </div>
</template>
