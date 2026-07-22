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
import { setFamilyPortalAccess } from '@/services/familyService'
import { getFamilyRows } from '@/services/reportsService'
import { ROUTE } from '@/router/routeNames'
import { useToastStore } from '@/stores/toastStore'
import type { FamilyMember, WithResident } from '@/types'

const router = useRouter()
const toast = useToastStore()

const rows = ref<WithResident<FamilyMember>[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)

const columns: TableColumn<WithResident<FamilyMember>>[] = [
  { key: 'name', label: 'Nama', value: (row) => row.name },
  { key: 'relation', label: 'Relasi', value: (row) => row.relation },
  { key: 'residentName', label: 'Penghuni' },
  { key: 'access', label: 'Akses Portal', align: 'right' },
  { key: 'actions', label: 'Aksi', align: 'right' },
]

async function load(): Promise<void> {
  loading.value = true
  rows.value = await getFamilyRows()
  loading.value = false
}

onMounted(load)

async function toggleAccess(row: WithResident<FamilyMember>): Promise<void> {
  busyId.value = row.id
  try {
    await setFamilyPortalAccess(row.id, !row.portalAccess)
    toast.push(row.portalAccess ? `Akses ${row.name} dicabut.` : `Akses ${row.name} diaktifkan.`)
    await load()
  } catch {
    toast.push('Gagal memperbarui akses.', 'error')
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
      title="Akses Keluarga"
      description="Kelola siapa saja yang bisa masuk ke Family Portal."
    />

    <LoadingState v-if="loading" :rows="4" />

    <BaseCard v-else title="Daftar Anggota Keluarga" flush>
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

        <template #cell-access="{ row }">
          <BaseBadge
            :status="row.portalAccess ? 'active' : 'inactive'"
            :label="row.portalAccess ? 'Aktif' : 'Nonaktif'"
          />
        </template>

        <template #cell-actions="{ row }">
          <BaseButton
            size="sm"
            :variant="row.portalAccess ? 'danger' : 'secondary'"
            :loading="busyId === row.id"
            @click="toggleAccess(row)"
          >
            {{ row.portalAccess ? 'Cabut' : 'Aktifkan' }}
          </BaseButton>
        </template>

        <template #empty>
          <div class="px-4">
            <EmptyState
              title="Belum ada anggota keluarga"
              description="Undang anggota keluarga dari halaman detail penghuni."
            />
          </div>
        </template>
      </BaseTable>
    </BaseCard>
  </div>
</template>
