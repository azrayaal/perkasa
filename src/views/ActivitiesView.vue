<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { updateActivityStatus } from '@/services/activityService'
import { getActivityRows } from '@/services/reportsService'
import { ROUTE } from '@/router/routeNames'
import { useToastStore } from '@/stores/toastStore'
import { formatDate } from '@/utils/formatDate'
import type { Activity, WithResident } from '@/types'

const router = useRouter()
const toast = useToastStore()

const rows = ref<WithResident<Activity>[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)

const columns: TableColumn<WithResident<Activity>>[] = [
  { key: 'activity', label: 'Aktivitas', value: (row) => row.activity },
  { key: 'residentName', label: 'Penghuni', value: (row) => row.residentName },
  { key: 'date', label: 'Tanggal', value: (row) => formatDate(row.date) },
  { key: 'status', label: 'Status', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getActivityRows()
  loading.value = false
}

onMounted(load)

async function setStatus(row: WithResident<Activity>, status: Activity['status']): Promise<void> {
  busyId.value = row.id
  try {
    await updateActivityStatus(row.id, status)
    toast.push(status === 'attended' ? 'Kehadiran dicatat.' : 'Booking dibatalkan.')
    await load()
  } catch {
    toast.push('Gagal memperbarui aktivitas.', 'error')
  } finally {
    busyId.value = null
  }
}

function openResident(residentId: string): void {
  void router.push({ name: ROUTE.residentDetail, params: { id: residentId } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      title="Aktivitas"
      description="Seluruh booking program komunitas beserta kehadirannya."
    />

    <LoadingState v-if="loading" :rows="4" />

    <BaseCard v-else title="Daftar Booking" flush>
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

        <template #cell-status="{ row }">
          <BaseBadge :status="row.status" />
        </template>

        <template #cell-actions="{ row }">
          <div v-if="row.status === 'booked'" class="flex justify-end gap-2">
            <BaseButton
              size="sm"
              variant="secondary"
              icon="check"
              :loading="busyId === row.id"
              @click="setStatus(row, 'attended')"
            >
              Hadir
            </BaseButton>
            <BaseButton
              size="sm"
              variant="danger"
              :loading="busyId === row.id"
              @click="setStatus(row, 'cancelled')"
            >
              Batal
            </BaseButton>
          </div>
          <span v-else class="text-sm text-ink-muted">—</span>
        </template>

        <template #empty>
          <div class="px-4">
            <EmptyState
              title="Belum ada aktivitas"
              description="Booking dapat dibuat dari halaman detail penghuni."
            />
          </div>
        </template>
      </BaseTable>
    </BaseCard>
  </div>
</template>
