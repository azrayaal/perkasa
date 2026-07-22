<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseTable from '@/components/ui/BaseTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import type { TableColumn } from '@/components/ui/BaseTable.types'
import { getUnitRows } from '@/services/reportsService'
import { updateUnitStatus } from '@/services/unitService'
import { ROUTE } from '@/router/routeNames'
import { useToastStore } from '@/stores/toastStore'
import type { UnitRow } from '@/types'

const router = useRouter()
const toast = useToastStore()

const rows = ref<UnitRow[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)

const occupied = computed(() => rows.value.filter((row) => row.unit.status === 'occupied').length)

const columns: TableColumn<UnitRow>[] = [
  { key: 'unitCode', label: 'Kode Unit', value: (row) => row.unit.unitCode },
  { key: 'type', label: 'Tipe', value: (row) => row.unit.type },
  { key: 'floor', label: 'Lantai', value: (row) => row.unit.floor },
  { key: 'occupant', label: 'Penghuni' },
  { key: 'status', label: 'Status', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getUnitRows()
  loading.value = false
}

onMounted(load)

/** Toggle cepat antara siap-huni dan perawatan. */
async function toggleMaintenance(row: UnitRow): Promise<void> {
  const next = row.unit.status === 'maintenance' ? 'vacant' : 'maintenance'
  busyId.value = row.unit.id

  try {
    await updateUnitStatus(row.unit.id, next)
    toast.push(`Unit ${row.unit.unitCode} → ${next === 'maintenance' ? 'perawatan' : 'kosong'}.`)
    await load()
  } catch {
    toast.push('Gagal memperbarui unit.', 'error')
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
      title="Unit & Properti"
      description="Status okupansi seluruh unit hunian."
    />

    <LoadingState v-if="loading" :rows="4" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Unit Terisi"
          :value="`${occupied} / ${rows.length}`"
          icon="unit"
          tone="accent"
        />
        <StatCard
          label="Tingkat Okupansi"
          :value="rows.length ? `${Math.round((occupied / rows.length) * 100)}%` : '—'"
          icon="dashboard"
        />
      </div>

      <BaseCard title="Daftar Unit" flush>
        <BaseTable :columns="columns" :rows="rows" :row-key="(row) => row.unit.id">
          <template #cell-unitCode="{ row }">
            <span class="identifier">{{ row.unit.unitCode }}</span>
          </template>

          <template #cell-occupant="{ row }">
            <button
              v-if="row.occupantId"
              type="button"
              class="font-medium text-ink-primary underline decoration-brand decoration-2 underline-offset-4 transition-colors hover:decoration-ink-primary"
              @click="openResident(row.occupantId)"
            >
              {{ row.occupantName }}
            </button>
            <span v-else class="text-ink-muted">Kosong</span>
          </template>

          <template #cell-status="{ row }">
            <BaseBadge :status="row.unit.status" />
          </template>

          <template #cell-actions="{ row }">
            <BaseButton
              size="sm"
              variant="secondary"
              :loading="busyId === row.unit.id"
              :disabled="row.unit.status === 'occupied'"
              @click="toggleMaintenance(row)"
            >
              {{ row.unit.status === 'maintenance' ? 'Selesai Perawatan' : 'Set Perawatan' }}
            </BaseButton>
          </template>

          <template #empty>
            <div class="px-4">
              <EmptyState title="Belum ada unit" description="Data properti belum tersedia." />
            </div>
          </template>
        </BaseTable>
      </BaseCard>
    </template>
  </div>
</template>
